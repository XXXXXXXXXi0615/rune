let _audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new AudioContext();
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.08) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playNoise(duration: number, volume = 0.03) {
  try {
    const ctx = getCtx();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  } catch {}
}

export function playPrinterStart() {
  playTone(800, 0.08, 'square', 0.04);
  setTimeout(() => playTone(1000, 0.06, 'square', 0.03), 60);
  setTimeout(() => playTone(600, 0.1, 'sawtooth', 0.02), 120);
}

export function playPrinterFeed() {
  playNoise(0.12, 0.02);
  playTone(2000, 0.04, 'square', 0.02);
}

export function playPrinterTear() {
  playNoise(0.15, 0.04);
  playTone(300, 0.08, 'sawtooth', 0.03);
}

export function playComplete() {
  playTone(880, 0.08, 'sine', 0.06);
  setTimeout(() => playTone(1100, 0.12, 'sine', 0.05), 80);
  setTimeout(() => playTone(1320, 0.15, 'sine', 0.04), 160);
}

export function playPunch() {
  playTone(150, 0.06, 'square', 0.06);
  setTimeout(() => playTone(100, 0.04, 'square', 0.04), 30);
}
