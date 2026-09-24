export type AudioEffectParameters = {
  preamp: number;
  low: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
  warmth: number;
  spatial: number;
  loudness: boolean;
  balance: number;
};

type Graph = {
  ctx: AudioContext;
  input: AudioNode;
  preamp: GainNode;
  filters: BiquadFilterNode[];
  compressor: DynamicsCompressorNode;
  panner: StereoPannerNode | null;
  master: GainNode;
};

let graph: Graph | null = null;
let current: AudioEffectParameters = {
  preamp: 0, low: 0, lowMid: 0, mid: 0, highMid: 0, high: 0,
  warmth: 0, spatial: 0, loudness: false, balance: 0,
};

export function ensureAudioEffectsGraph(ctx: AudioContext, input: AudioNode): Graph | null {
  if (graph?.ctx === ctx && graph.input === input) return graph;
  try {
    input.disconnect();
    const preamp = ctx.createGain();
    const frequencies = [80, 250, 1000, 4000, 10000];
    const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
    const filters = frequencies.map((frequency, index) => {
      const node = ctx.createBiquadFilter();
      node.type = types[index];
      node.frequency.value = frequency;
      node.Q.value = index === 0 || index === 4 ? 0.7 : 1;
      return node;
    });
    const compressor = ctx.createDynamicsCompressor();
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    const master = ctx.createGain();
    const chain: AudioNode[] = [input, preamp, ...filters, compressor];
    if (panner) chain.push(panner);
    chain.push(master, ctx.destination);
    chain.forEach((node, index) => chain[index + 1] && node.connect(chain[index + 1]));
    graph = { ctx, input, preamp, filters, compressor, panner, master };
    applyAudioEffects(current);
    try { (window as any).__lunartideAudioEffectsGraph = graph; } catch {}
    return graph;
  } catch {
    try { input.connect(ctx.destination); } catch {}
    graph = null;
    return null;
  }
}

export function applyAudioEffects(parameters: AudioEffectParameters): boolean {
  current = parameters;
  if (!graph) return false;
  const now = graph.ctx.currentTime;
  const values = [parameters.low, parameters.lowMid + parameters.warmth * 0.06, parameters.mid, parameters.highMid, parameters.high - parameters.warmth * 0.035];
  graph.preamp.gain.setTargetAtTime(Math.pow(10, parameters.preamp / 20), now, 0.015);
  graph.filters.forEach((filter, index) => filter.gain.setTargetAtTime(values[index], now, 0.015));
  graph.compressor.threshold.setTargetAtTime(parameters.loudness ? -24 : -3, now, 0.02);
  graph.compressor.ratio.setTargetAtTime(parameters.loudness ? 4 : 1, now, 0.02);
  graph.compressor.knee.setTargetAtTime(parameters.loudness ? 18 : 0, now, 0.02);
  graph.master.gain.setTargetAtTime(1 + parameters.spatial * 0.0015, now, 0.02);
  graph.panner?.pan.setTargetAtTime(parameters.balance, now, 0.015);
  return true;
}

export function getAudioEffectsGraphStatus() {
  return { supported: typeof AudioContext !== 'undefined', connected: Boolean(graph), current };
}
