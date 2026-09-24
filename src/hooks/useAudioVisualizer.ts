import { useEffect, useRef, type RefObject } from 'react'
import { getMusicAnalyser } from '@/store/musicStore'

const BAR_COUNT = 72
const BAR_GAP = 3
const REFLECTION_RATIO = 0.32

function cssVar(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback
}

export function useAudioVisualizer(
  _audioRef: RefObject<HTMLAudioElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  isPlaying: boolean,
) {
  const playingRef = useRef(isPlaying)

  useEffect(() => { playingRef.current = isPlaying }, [isPlaying])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    if (!context) return undefined

    let dataArray: Uint8Array<ArrayBuffer> | null = null
    const smooth = new Float32Array(BAR_COUNT)
    // Frozen frame: when transitioning from playing → paused, keep the last bar heights
    const frozen = new Float32Array(BAR_COUNT)
    let hasFrozenFrame = false
    let animationId = 0
    let breathPhase = 0
    let width = 0
    let height = 0
    let dpr = 1
    let wasPlaying = false

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = window.devicePixelRatio || 1
      width = rect.width || canvas.parentElement?.clientWidth || 320
      height = rect.height || 150
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = () => {
      if (width <= 0 || height <= 0) resize()
      context.clearRect(0, 0, width, height)
      const mainHeight = height / (1 + REFLECTION_RATIO)
      const barWidth = Math.max(2, (width - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT)
      const root = document.documentElement
      const accent = cssVar(root, '--accent', '#d48ba5')
      const coral = cssVar(root, '--coral', '#f2b8cc')
      const muted = cssVar(root, '--text-3', '#817b76')

      const playing = playingRef.current
      const ma = getMusicAnalyser()
      const analyser = ma?.analyser ?? null

      if (dataArray && analyser && analyser.frequencyBinCount !== dataArray.length) {
        dataArray = null // force rebuild if fftSize changed
      }
      if (!dataArray && analyser) {
        dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
      }

      const heights = new Float32Array(BAR_COUNT)

      if (playing && analyser && dataArray) {
        // ── Playing: live FFT spectrum ──
        analyser.getByteFrequencyData(dataArray)
        for (let i = 0; i < BAR_COUNT; i += 1) {
          const t = i / (BAR_COUNT - 1)
          const bin = Math.min(dataArray.length - 1, Math.floor(Math.pow(t, 1.7) * dataArray.length))
          const raw = dataArray[bin] / 255
          smooth[i] += (raw - smooth[i]) * 0.16
          heights[i] = Math.max(0.04, smooth[i])
        }
        // Capture freeze frame for when we pause
        frozen.set(heights)
        hasFrozenFrame = true
        wasPlaying = true
      } else if (wasPlaying && hasFrozenFrame) {
        // ── Paused after playing: freeze frame (last spectrum) ──
        // Slowly decay the frozen bars for a gentle fade-out over ~3s
        for (let i = 0; i < BAR_COUNT; i += 1) {
          frozen[i] *= 0.997
          heights[i] = Math.max(0.03, frozen[i])
        }
      } else {
        // ── Idle (never played yet): subtle breathing ──
        breathPhase += 0.026
        for (let i = 0; i < BAR_COUNT; i += 1) {
          const t = i / (BAR_COUNT - 1)
          const distance = Math.abs(t - 0.5) * 2
          heights[i] = 0.05 + (Math.sin(breathPhase - distance * Math.PI * 1.2) * 0.5 + 0.5) * 0.11
        }
      }

      const average = heights.reduce((sum, v) => sum + v, 0) / BAR_COUNT
      if ((playing || hasFrozenFrame) && average > 0.06) {
        const glow = context.createRadialGradient(width / 2, mainHeight, 0, width / 2, mainHeight, width * 0.38)
        glow.addColorStop(0, 'rgba(212,139,165,0.18)')
        glow.addColorStop(1, 'rgba(212,139,165,0)')
        context.fillStyle = glow
        context.fillRect(0, 0, width, mainHeight)
      }

      const showAsPlaying = playing || (wasPlaying && hasFrozenFrame && average > 0.04)
      for (let i = 0; i < BAR_COUNT; i += 1) {
        const x = i * (barWidth + BAR_GAP)
        const barHeight = Math.max(4, heights[i] * mainHeight * 0.94)
        const y = mainHeight - barHeight
        const gradient = context.createLinearGradient(0, y, 0, mainHeight)
        gradient.addColorStop(0, showAsPlaying ? coral : muted)
        gradient.addColorStop(1, showAsPlaying ? accent : muted)
        context.fillStyle = gradient
        context.globalAlpha = showAsPlaying ? 0.88 : 0.38
        context.fillRect(x, y, barWidth, barHeight)
        context.globalAlpha = showAsPlaying ? 0.16 : 0.08
        context.fillRect(x, mainHeight + 3, barWidth, barHeight * REFLECTION_RATIO)
      }
      context.globalAlpha = 1
      animationId = requestAnimationFrame(draw)
    }

    resize()
    animationId = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
      // NOTE: do NOT close AudioContext here — it's managed globally by musicStore
    }
  }, [canvasRef])
}
