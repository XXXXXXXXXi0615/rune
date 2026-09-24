/** Keep legacy Rune character IDs/assets stable while avoiding a product-name collision. */
export function resolveCharacterDisplayName(id: string | undefined, displayName: string | undefined): string {
  if (displayName === 'Rune' && (id?.startsWith('rune_') || id?.startsWith('rune-'))) return 'Rime';
  return displayName || '智能體';
}
