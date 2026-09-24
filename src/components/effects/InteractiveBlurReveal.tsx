import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import './InteractiveBlurReveal.css';

const MAX_TRAIL_POINTS = 240;
const DEFAULT_POINTER_POSITION = 0.5;
const DEFAULT_FRAME_TIME_MS = 16.67;
const MAX_FRAME_DELTA_MS = 64;
const POINTER_LERP_FACTOR = 0.001;
const POINTER_LEAVE_DURATION_MS = 180;
const TRAIL_LIFETIME_MS = 650;
const MIN_POINTER_DISTANCE_INSIDE = 0.0022;
const MIN_POINTER_DISTANCE_LEAVING = 0.0013;
const MAX_DEVICE_PIXEL_RATIO = 1.5;

export type FrostVariant = 'original' | 'rune';
export type FrostRuntimeState = 'initializing' | 'webgl' | 'reduced-motion' | 'coarse-pointer' | 'fallback';

type TrailPoint = { x: number; y: number; time: number; strength: number };

const FROST_VISUALS: Record<FrostVariant, {
  blurRadius: number;
  distortion: number;
  tint: readonly [number, number, number];
  tintMix: number;
  grain: number;
  filmGrainFrosted: number;
  filmGrainClear: number;
  vignetteEdge: number;
  revealContrast: number;
}> = {
  original: {
    blurRadius: 42,
    distortion: 0.012,
    tint: [0.70, 0.76, 0.78],
    tintMix: 0.18,
    grain: 0.045,
    filmGrainFrosted: 0.24,
    filmGrainClear: 0.12,
    vignetteEdge: 0.96,
    revealContrast: 1,
  },
  rune: {
    blurRadius: 32,
    distortion: 0.006,
    tint: [0.975, 0.945, 0.875],
    tintMix: 0.44,
    grain: 0.014,
    filmGrainFrosted: 0.052,
    filmGrainClear: 0.022,
    vignetteEdge: 0.992,
    revealContrast: 1.08,
  },
};

const FULLSCREEN_TRIANGLE_VERTICES = new Float32Array([
  -1, -1, 1, -1, -1, 1,
  -1, 1, 1, -1, 1, 1,
]);

const VERTEX_SHADER = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
#define MAX_TRAIL_POINTS 240
uniform vec2 iResolution;
uniform vec2 iImageResolution;
uniform float iTime;
uniform vec2 iTrail[MAX_TRAIL_POINTS];
uniform float iTrailAlpha[MAX_TRAIL_POINTS];
uniform int iTrailCount;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform float uBlurRadius;
uniform float uDistortion;
uniform vec3 uFrostTint;
uniform float uTintMix;
uniform float uGrainStrength;
uniform float uFilmGrainFrosted;
uniform float uFilmGrainClear;
uniform float uVignetteEdge;
uniform float uRevealContrast;
uniform float uImageFit;
out vec4 fragColor;

vec3 fittedUv(vec2 uv) {
  float screenAspect = iResolution.x / iResolution.y;
  float imageAspect = iImageResolution.x / iImageResolution.y;
  vec2 coverScale = screenAspect > imageAspect
    ? vec2(1.0, imageAspect / screenAspect)
    : vec2(screenAspect / imageAspect, 1.0);
  vec2 containScale = screenAspect > imageAspect
    ? vec2(imageAspect / screenAspect, 1.0)
    : vec2(1.0, screenAspect / imageAspect);
  vec2 cover = (uv - 0.5) * coverScale + 0.5;
  vec2 contain = (uv - 0.5) / containScale + 0.5;
  float inside = step(0.0, contain.x) * step(contain.x, 1.0) * step(0.0, contain.y) * step(contain.y, 1.0);
  return vec3(mix(cover, contain, uImageFit), mix(1.0, inside, uImageFit));
}
vec2 distortUv(vec2 uv) {
  vec2 noiseOffset = texture(iChannel1, uv * 2.2).xy - 0.5;
  return uv + noiseOffset * uDistortion;
}
vec4 blur21(sampler2D tex, vec2 uv, float radiusPx) {
  vec2 px = radiusPx / iResolution;
  vec4 color = texture(tex, uv) * 0.12;
  color += texture(tex, uv + px * vec2(1.,0.)) * .08;
  color += texture(tex, uv + px * vec2(-1.,0.)) * .08;
  color += texture(tex, uv + px * vec2(0.,1.)) * .08;
  color += texture(tex, uv + px * vec2(0.,-1.)) * .08;
  color += texture(tex, uv + px * vec2(1.,1.)) * .065;
  color += texture(tex, uv + px * vec2(-1.,1.)) * .065;
  color += texture(tex, uv + px * vec2(1.,-1.)) * .065;
  color += texture(tex, uv + px * vec2(-1.,-1.)) * .065;
  color += texture(tex, uv + px * vec2(2.,0.)) * .045;
  color += texture(tex, uv + px * vec2(-2.,0.)) * .045;
  color += texture(tex, uv + px * vec2(0.,2.)) * .045;
  color += texture(tex, uv + px * vec2(0.,-2.)) * .045;
  color += texture(tex, uv + px * vec2(3.,1.)) * .025;
  color += texture(tex, uv + px * vec2(-3.,1.)) * .025;
  color += texture(tex, uv + px * vec2(3.,-1.)) * .025;
  color += texture(tex, uv + px * vec2(-3.,-1.)) * .025;
  return color;
}
float sdSegment(vec2 point, vec2 start, vec2 end) {
  vec2 pointDelta = point - start;
  vec2 segmentDelta = end - start;
  float projection = clamp(dot(pointDelta, segmentDelta) / max(dot(segmentDelta, segmentDelta), .00001), 0., 1.);
  return length(pointDelta - segmentDelta * projection);
}
float fluidTrailRevealMask(vec2 uv) {
  float aspect = iResolution.x / iResolution.y;
  vec2 point = vec2(uv.x * aspect, uv.y);
  float mask = 0.;
  for (int i = 0; i < MAX_TRAIL_POINTS - 1; i++) {
    if (i >= iTrailCount - 1) break;
    vec2 start = vec2(iTrail[i].x * aspect, iTrail[i].y);
    vec2 end = vec2(iTrail[i + 1].x * aspect, iTrail[i + 1].y);
    float alpha = min(iTrailAlpha[i], iTrailAlpha[i + 1]);
    float distanceToTrail = sdSegment(point, start, end);
    float noiseA = texture(iChannel1, uv * 4. + float(i) * .018).r;
    float noiseB = texture(iChannel1, uv * 10. + vec2(noiseA * .4, float(i) * .01)).r;
    float noiseC = texture(iChannel1, uv * 24. - float(i) * .006).r;
    float fluidNoise = noiseA * .45 + noiseB * .35 + noiseC * .20;
    float radius = .095 + (fluidNoise - .5) * .055;
    float localMask = 1. - smoothstep(radius, radius + .09, distanceToTrail);
    mask = max(mask, localMask * alpha);
  }
  float cloudNoise = texture(iChannel1, uv * 7.).r;
  float fineNoise = texture(iChannel1, uv * 22.).r;
  mask *= smoothstep(.12, .95, mask + cloudNoise * .25 + fineNoise * .12);
  return clamp((mask - .5) * uRevealContrast + .5, 0., 1.);
}
vec3 filmGrain(vec2 uv) {
  vec2 coarseUv = uv * (iResolution.xy / 260.) + vec2(iTime * .035, -iTime * .028);
  vec2 fineUv = uv * (iResolution.xy / 120.) + vec2(-iTime * .055, iTime * .041);
  vec3 coarse = texture(iChannel1, coarseUv).rgb - .5;
  float fine = texture(iChannel1, fineUv).r - .5;
  return vec3(coarse.r, coarse.g * .9, coarse.b * 1.1) * .95 + fine * .65;
}
void main() {
  vec2 screenUv = gl_FragCoord.xy / iResolution.xy;
  screenUv.y = 1. - screenUv.y;
  vec3 fitted = fittedUv(screenUv);
  if (fitted.z < .5) { fragColor = vec4(0.); return; }
  vec2 imageUv = fitted.xy;
  vec4 frosted = blur21(iChannel0, distortUv(imageUv), uBlurRadius);
  vec4 clearImage = texture(iChannel0, imageUv);
  float reveal = fluidTrailRevealMask(screenUv);
  float grain = texture(iChannel1, screenUv * iResolution.xy / 180.).r;
  frosted.rgb = mix(frosted.rgb, uFrostTint, uTintMix);
  frosted.rgb += (grain - .5) * uGrainStrength;
  vec4 mixed = mix(frosted, clearImage, reveal);
  mixed.rgb += filmGrain(screenUv) * mix(uFilmGrainFrosted, uFilmGrainClear, reveal);
  vec2 delta = screenUv - .5;
  float vignette = smoothstep(.85, .25, dot(delta, delta) * 1.35);
  mixed.rgb *= mix(uVignetteEdge, 1., vignette);
  fragColor = vec4(clamp(mixed.rgb, 0., 1.), mixed.a);
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Shader allocation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader) ?? 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${detail}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Program allocation failed');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const detail = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    throw new Error(`Program linking failed: ${detail}`);
  }
  return program;
}

function createNoiseTextureSource() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Noise canvas unavailable');
  const data = context.createImageData(canvas.width, canvas.height);
  let seed = 0x4d6f6f6e;
  for (let index = 0; index < data.data.length; index += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = seed & 255;
    data.data[index] = value;
    data.data[index + 1] = value;
    data.data[index + 2] = value;
    data.data[index + 3] = 255;
  }
  context.putImageData(data, 0, 0);
  return canvas;
}

function createTexture(gl: WebGL2RenderingContext, source: TexImageSource, unit: number, repeat: boolean) {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Texture allocation failed');
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function loadImage(src: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const finish = () => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onLoad = () => { finish(); resolve(image); };
    const onError = () => { finish(); reject(new Error('Artwork texture unavailable')); };
    const onAbort = () => { finish(); reject(new Error('Artwork texture loading cancelled')); };
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
    image.src = src;
  });
}

type InteractiveBlurRevealProps = {
  imageSrc: string;
  alt: string;
  variant: FrostVariant;
  forceReducedMotion?: boolean;
  forceFallback?: boolean;
  className?: string;
  style?: CSSProperties;
  showDiagnostics?: boolean;
  imageFit?: 'cover' | 'contain';
};

export function InteractiveBlurReveal({
  imageSrc,
  alt,
  variant,
  forceReducedMotion = false,
  forceFallback = false,
  className = '',
  style,
  showDiagnostics = false,
  imageFit = 'cover',
}: InteractiveBlurRevealProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeFrameRef = useRef<(() => void) | null>(null);
  const pointerRef = useRef({
    isInside: false,
    targetX: DEFAULT_POINTER_POSITION,
    targetY: DEFAULT_POINTER_POSITION,
    x: DEFAULT_POINTER_POSITION,
    y: DEFAULT_POINTER_POSITION,
    lastTime: 0,
    isLeaving: false,
    leaveAt: 0,
  });
  const trailRef = useRef<TrailPoint[]>([]);
  const [runtimeState, setRuntimeState] = useState<FrostRuntimeState>('initializing');

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const hostElement = host;
    const canvasElement = canvas;
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarseQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    if (forceFallback) { setRuntimeState('fallback'); return; }
    if (forceReducedMotion || reducedQuery.matches) { setRuntimeState('reduced-motion'); return; }
    if (coarseQuery.matches) { setRuntimeState('coarse-pointer'); return; }

    let disposed = false;
    let rafId = 0;
    let resizeRafId = 0;
    let frameCount = 0;
    let resourcesReleased = false;
    const abortController = new AbortController();
    const disposers: Array<() => void> = [];

    const releaseResources = () => {
      if (resourcesReleased) return;
      resourcesReleased = true;
      disposers.reverse().forEach((dispose) => dispose());
    };

    const failSafely = () => {
      if (disposed) return;
      canvasElement.style.opacity = '0';
      hostElement.dataset.renderState = 'stopped';
      setRuntimeState('fallback');
      disposed = true;
      abortController.abort();
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(resizeRafId);
      wakeFrameRef.current = null;
      releaseResources();
    };

    async function initialize() {
      const gl = canvasElement.getContext('webgl2', { alpha: true, antialias: false });
      if (!gl) throw new Error('WebGL2 unavailable');
      const program = createProgram(gl);
      disposers.push(() => gl.deleteProgram(program));
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error('Buffer allocation failed');
      disposers.push(() => gl.deleteBuffer(buffer));
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE_VERTICES, gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const artwork = await loadImage(imageSrc, abortController.signal);
      if (disposed) return;
      const artworkTexture = createTexture(gl, artwork, 0, false);
      const noiseTexture = createTexture(gl, createNoiseTextureSource(), 1, true);
      disposers.push(() => gl.deleteTexture(artworkTexture), () => gl.deleteTexture(noiseTexture));

      const uniform = (name: string) => gl.getUniformLocation(program, name);
      const resolution = uniform('iResolution');
      const imageResolution = uniform('iImageResolution');
      const time = uniform('iTime');
      const trail = uniform('iTrail[0]');
      const trailAlpha = uniform('iTrailAlpha[0]');
      const trailCount = uniform('iTrailCount');
      gl.uniform1i(uniform('iChannel0'), 0);
      gl.uniform1i(uniform('iChannel1'), 1);
      gl.uniform2f(imageResolution, artwork.naturalWidth, artwork.naturalHeight);
      const visual = FROST_VISUALS[variant];
      gl.uniform1f(uniform('uBlurRadius'), visual.blurRadius);
      gl.uniform1f(uniform('uDistortion'), visual.distortion);
      gl.uniform3f(uniform('uFrostTint'), ...visual.tint);
      gl.uniform1f(uniform('uTintMix'), visual.tintMix);
      gl.uniform1f(uniform('uGrainStrength'), visual.grain);
      gl.uniform1f(uniform('uFilmGrainFrosted'), visual.filmGrainFrosted);
      gl.uniform1f(uniform('uFilmGrainClear'), visual.filmGrainClear);
      gl.uniform1f(uniform('uVignetteEdge'), visual.vignetteEdge);
      gl.uniform1f(uniform('uRevealContrast'), visual.revealContrast);
      gl.uniform1f(uniform('uImageFit'), imageFit === 'contain' ? 1 : 0);

      const trailData = new Float32Array(MAX_TRAIL_POINTS * 2);
      const trailAlphaData = new Float32Array(MAX_TRAIL_POINTS);
      const resize = () => {
        const rect = hostElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));
        hostElement.dataset.dpr = String(dpr);
        if (canvasElement.width !== width || canvasElement.height !== height) {
          canvasElement.width = width;
          canvasElement.height = height;
          gl.viewport(0, 0, width, height);
        }
      };

      const render = () => {
        rafId = 0;
        if (disposed) return;
        const now = performance.now();
        const pointer = pointerRef.current;
        const delta = pointer.lastTime ? Math.min(MAX_FRAME_DELTA_MS, now - pointer.lastTime) : DEFAULT_FRAME_TIME_MS;
        pointer.lastTime = now;
        const smoothing = 1 - Math.pow(POINTER_LERP_FACTOR, delta / 1000);
        pointer.x += (pointer.targetX - pointer.x) * smoothing;
        pointer.y += (pointer.targetY - pointer.y) * smoothing;
        const leavingAge = pointer.isLeaving ? now - pointer.leaveAt : 0;
        const leavingActive = pointer.isLeaving && leavingAge < POINTER_LEAVE_DURATION_MS;
        const pushStrength = pointer.isInside ? 1 : leavingActive ? 1 - leavingAge / POINTER_LEAVE_DURATION_MS : 0;
        if (pushStrength > 0) {
          const currentTrail = trailRef.current;
          const last = currentTrail[currentTrail.length - 1];
          const distance = last ? Math.hypot(pointer.x - last.x, pointer.y - last.y) : 1;
          const minimum = pointer.isInside ? MIN_POINTER_DISTANCE_INSIDE : MIN_POINTER_DISTANCE_LEAVING;
          if (!last || distance > minimum) currentTrail.push({ x: pointer.x, y: pointer.y, time: now, strength: pushStrength });
        }
        let currentTrail = trailRef.current.filter((point) => now - point.time < TRAIL_LIFETIME_MS);
        if (currentTrail.length > MAX_TRAIL_POINTS) currentTrail = currentTrail.slice(-MAX_TRAIL_POINTS);
        trailRef.current = currentTrail;
        trailData.fill(0);
        trailAlphaData.fill(0);
        currentTrail.forEach((point, index) => {
          const life = Math.max(0, 1 - (now - point.time) / TRAIL_LIFETIME_MS);
          const alpha = life * life * (3 - 2 * life);
          trailData[index * 2] = point.x;
          trailData[index * 2 + 1] = point.y;
          trailAlphaData[index] = alpha * point.strength;
        });
        gl.uniform1f(time, now / 1000);
        gl.uniform2f(resolution, canvasElement.width, canvasElement.height);
        gl.uniform2fv(trail, trailData);
        gl.uniform1fv(trailAlpha, trailAlphaData);
        gl.uniform1i(trailCount, currentTrail.length);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        frameCount += 1;
        hostElement.dataset.frameCount = String(frameCount);
        canvasElement.style.opacity = '1';
        const shouldContinue = pointer.isInside || leavingActive || currentTrail.length > 0;
        hostElement.dataset.renderState = shouldContinue ? 'running' : 'stopped';
        if (shouldContinue) rafId = requestAnimationFrame(render);
      };
      const wake = () => {
        if (disposed || rafId) return;
        hostElement.dataset.renderState = 'running';
        rafId = requestAnimationFrame(render);
      };
      wakeFrameRef.current = wake;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(resizeRafId);
        resizeRafId = requestAnimationFrame(() => { resize(); wake(); });
      });
      observer.observe(hostElement);
      disposers.push(() => observer.disconnect());
      const onContextLost = (event: Event) => { event.preventDefault(); failSafely(); };
      canvasElement.addEventListener('webglcontextlost', onContextLost);
      disposers.push(() => canvasElement.removeEventListener('webglcontextlost', onContextLost));
      resize();
      setRuntimeState('webgl');
      render();
    }

    void initialize().catch(failSafely);
    return () => {
      disposed = true;
      abortController.abort();
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(resizeRafId);
      wakeFrameRef.current = null;
      releaseResources();
    };
  }, [forceFallback, forceReducedMotion, imageFit, imageSrc, variant]);

  const updatePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current.targetX = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    pointerRef.current.targetY = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
  };
  const onPointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    pointerRef.current.isInside = true;
    pointerRef.current.isLeaving = false;
    updatePointer(event);
    wakeFrameRef.current?.();
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    updatePointer(event);
    wakeFrameRef.current?.();
  };
  const onPointerLeave = () => {
    pointerRef.current.isInside = false;
    pointerRef.current.isLeaving = true;
    pointerRef.current.leaveAt = performance.now();
    wakeFrameRef.current?.();
  };

  return (
    <div
      ref={hostRef}
      className={`interactive-blur-reveal interactive-blur-reveal--${variant} ${className}`.trim()}
      style={style}
      data-testid="interactive-blur-reveal"
      data-runtime-state={runtimeState}
      data-render-state="stopped"
      data-frame-count="0"
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
    >
      <img className="interactive-blur-reveal__art" src={imageSrc} alt={alt} style={{ objectFit: imageFit }} />
      <div className="interactive-blur-reveal__static-frost" aria-hidden="true" />
      <canvas ref={canvasRef} className="interactive-blur-reveal__canvas" aria-hidden="true" />
      {showDiagnostics ? (
        <span className="interactive-blur-reveal__status" aria-hidden="true">
          {runtimeState === 'webgl' ? 'WebGL2 · pointer reveal' : runtimeState.replace('-', ' ')}
        </span>
      ) : null}
    </div>
  );
}

export const INTERACTIVE_FROST_CONTRACT = {
  MAX_TRAIL_POINTS,
  TRAIL_LIFETIME_MS,
  POINTER_LEAVE_DURATION_MS,
  MAX_DEVICE_PIXEL_RATIO,
  visuals: FROST_VISUALS,
} as const;
