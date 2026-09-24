import type { SimulatedCallState } from '@/types';

const CALL_TRANSITIONS: Record<SimulatedCallState, SimulatedCallState[]> = {
  ringing: ['connecting', 'ended', 'failed'],
  connecting: ['active', 'ended', 'failed'],
  active: ['reconnecting', 'ended', 'failed'],
  reconnecting: ['active', 'ended', 'failed'],
  ended: [],
  failed: [],
};

export function canTransitionCall(from: SimulatedCallState, to: SimulatedCallState): boolean {
  return CALL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isCallLive(state: SimulatedCallState): boolean {
  return state === 'ringing' || state === 'connecting' || state === 'active' || state === 'reconnecting';
}

export function callStateLabel(state: SimulatedCallState): string {
  switch (state) {
    case 'ringing': return '響鈴中…';
    case 'connecting': return '接通中…';
    case 'active': return '通話中';
    case 'reconnecting': return '重新連線中…';
    case 'ended': return '通話已結束';
    case 'failed': return '通話失敗';
  }
}
