import { hashSeed } from '@/utils/scriptedVoice';

const OPENERS = [
  '嗯，我在聽。',
  '我聽到了。',
  '好呀。',
  '讓我想一想。',
  '謝謝你告訴我。',
];

const REFLECTIONS = [
  '你剛剛說「{quote}」，可以多說一點嗎？',
  '關於「{quote}」，我想知道你現在的感覺。',
  '「{quote}」——這件事對你來說重要嗎？',
  '我記下「{quote}」了，之後也可以放進手記裡。',
  '聽起來「{quote}」讓你有些在意。',
];

const CLOSERS = [
  '我會一直在這裡。',
  '慢慢說，不急。',
  '需要的話我們可以把它存進記憶。',
  '今晚的潮汐很穩，放心說。',
  '你想繼續，我就繼續聽。',
];

/**
 * Deterministic local reply generator for simulated calls.
 * This is a persona-flavoured mock — a real AI provider can replace it later
 * behind the same interface.
 */
export function generateCallReply(userText: string, identityName = 'LUNARIS'): string {
  const trimmed = userText.trim();
  if (!trimmed) return `${identityName} 靜靜看著你，等你開口。`;
  const seed = hashSeed(trimmed);
  const quote = trimmed.length > 18 ? `${trimmed.slice(0, 18)}…` : trimmed;
  const opener = OPENERS[seed % OPENERS.length];
  const reflection = REFLECTIONS[(seed >>> 3) % REFLECTIONS.length].replace('{quote}', quote);
  const closer = CLOSERS[(seed >>> 7) % CLOSERS.length];
  return `${opener}${reflection}${closer}`;
}

export function generateCallGreeting(identityName = 'LUNARIS'): string {
  return `嗨，我是 ${identityName}。訊號接上了，今天想聊些什麼？`;
}
