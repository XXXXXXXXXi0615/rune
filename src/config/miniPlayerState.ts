export const MINI_PLAYER_STATE_KEY = 'lunartide_mini_player_position_v1';
export const MINI_PLAYER_RESET_EVENT = 'lunartide:mini-player-reset';

export function resetMiniPlayerState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(MINI_PLAYER_STATE_KEY);
  } catch {
    // The current tab can still reset through the runtime event.
  }
  window.dispatchEvent(new CustomEvent(MINI_PLAYER_RESET_EVENT));
}
