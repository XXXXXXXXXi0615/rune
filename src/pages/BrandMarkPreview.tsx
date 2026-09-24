import { LunartideLogo } from '@/components/branding/LunartideLogo';

const sizes = [16, 20, 24, 28, 32, 40, 48, 64];
const themes = [
  { id: 'light', label: 'Light', attrs: { 'data-theme': 'light', 'data-appearance-preset': 'lunartide' } },
  { id: 'dark', label: 'Dark', attrs: { 'data-theme': 'dark', 'data-appearance-preset': 'lunartide' } },
  { id: 'island', label: 'Tide Island', attrs: { 'data-theme': 'light', 'data-appearance-preset': 'tide-island' } },
] as const;

/** Development-only visual acceptance surface. It deliberately renders the production inline component. */
export function BrandMarkPreview() {
  return <main className="brand-mark-preview"><h1>Lunartide Mark v2</h1>{themes.map((theme) => <section key={theme.id} className="brand-mark-preview-theme" {...theme.attrs}><h2>{theme.label}</h2><div className="brand-mark-preview-row">{sizes.map((size) => <figure key={size}><LunartideLogo variant="ui" size={size} /><figcaption>{size}px</figcaption></figure>)}</div><div className="brand-mark-preview-thinking"><LunartideLogo variant="animated" state="thinking" size={48} decorative /><span>Thinking</span></div></section>)}</main>;
}
