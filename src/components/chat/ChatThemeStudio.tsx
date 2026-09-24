import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { BubbleSkinStudioSection } from '@/components/chat/BubbleSkinStudioSection';
import type { ChatBubbleSkin } from '@/features/chat/bubbleSkin/types';
import { BubbleSkinPreviewContext } from '@/features/chat/bubbleSkin/BubbleSkinPreviewContext';
import { useRuneStashStore, type RuneStashPaletteItem } from '@/features/stash/useRuneStashStore';
import type { ChatThemeDraftSeed } from '@/features/stash/chatThemeDraftBridge';
import { approximateBubbleColor, chatThemeStyle, contrastRatio, CURATED_CHAT_THEME_PRESETS, type ChatBubbleFill, type ChatBubbleStyle, type ChatTheme, useChatThemeStore } from '@/store/useChatThemeStore';
import { useCompanionPetStore } from '@/store/useCompanionPetStore';
import type { Message, TextMessage } from '@/types';
import './ChatThemeStudio.css';

interface Props { open: boolean; onClose: () => void; seed?: ChatThemeDraftSeed | null; openPaletteMapping?: boolean }
type Target = 'myBubble' | 'agentBubble';
type ColorField = 'solid' | 'gradientA' | 'gradientB' | 'glassBase' | 'border' | 'text' | 'background' | 'accent';

const previewMessages: TextMessage[] = [
  { id: 'theme-agent-short', type: 'text', sender: 'assistant', content: '那就別一邊喊累，一邊又把事情拖到半夜。', time: new Date(0).toISOString(), status: 'read' },
  { id: 'theme-agent-long', type: 'text', sender: 'assistant', content: '這是多行訊息，包含 [連結](https://example.com) 與 `inline code`，用來確認真實訊息內容的可讀性。', time: new Date(60_000).toISOString(), status: 'read' },
  { id: 'theme-user-short', type: 'text', sender: 'me', content: '今天有點累。', time: new Date(120_000).toISOString(), status: 'read' },
  { id: 'theme-user-long', type: 'text', sender: 'me', content: '這是使用者的多行訊息。透明度只作用在背景，文字仍然保持完整不透明。', time: new Date(180_000).toISOString(), status: 'read' },
];

const validHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim());
const colorInput = (value: string) => validHex(value) ? value : '#000000';

function fillColor(fill: ChatBubbleFill, field: ColorField): string {
  if (field === 'text' || field === 'border') return '#000000';
  if (fill.kind === 'solid') return fill.color;
  if (fill.kind === 'gradient') return field === 'gradientB' ? fill.colorB : fill.colorA;
  return fill.baseColor;
}

function BubbleControls({ label, value, onChange, onChoose }: { label: string; value: ChatBubbleStyle; onChange: (value: ChatBubbleStyle) => void; onChoose: (field: ColorField) => void }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const updateFill = (patch: Partial<ChatBubbleFill>) => onChange({ ...value, fill: { ...value.fill, ...patch } as ChatBubbleFill });
  const setKind = (kind: ChatBubbleFill['kind']) => {
    if (kind === 'solid') updateFill({ kind, color: fillColor(value.fill, 'solid'), alpha: .82 });
    if (kind === 'gradient') updateFill({ kind, colorA: fillColor(value.fill, 'gradientA'), colorB: '#89B8C2', angle: 135, stopA: 0, stopB: 100, alphaA: .9, alphaB: .9 });
    if (kind === 'glass') updateFill({ kind, baseColor: fillColor(value.fill, 'glassBase'), alpha: .52, blur: 18, saturation: 1.06, borderColor: value.borderColor, borderAlpha: .45, borderWidth: 1 });
  };
  const colorControl = (labelText: string, field: ColorField, valueText: string, onValue: (next: string) => void) => <div className="cts-color-control"><label><span>{labelText}</span><span><input type="color" value={colorInput(valueText)} onChange={(event) => onValue(event.target.value.toUpperCase())}/><input aria-label={`${label} ${labelText} HEX`} value={valueText} onChange={(event) => onValue(event.target.value.toUpperCase())}/></span></label><button type="button" onClick={() => onChoose(field)}>Choose from Rune Stash</button></div>;
  const range = (labelText: string, valueNumber: number, min: number, max: number, step: number, onValue: (next: number) => void) => <label className="cts-range"><span>{labelText}<output>{valueNumber}</output></span><input aria-label={`${label} ${labelText}`} type="range" min={min} max={max} step={step} value={valueNumber} onChange={(event) => onValue(Number(event.target.value))}/></label>;
  const approximate = approximateBubbleColor(value.fill);
  const ratio = contrastRatio(value.textColor, approximate);
  const opacityValue = value.fill.kind === 'gradient' ? value.fill.alphaA : value.fill.alpha;
  const setOpacity = (next: number) => {
    if (value.fill.kind === 'gradient') updateFill({ alphaA: next });
    else updateFill({ alpha: next });
  };
  return <section className="cts-bubble-section" aria-label={label}>
    <header><h3>{label}</h3><span className={ratio >= 4.5 ? 'is-good' : 'is-low'}>{ratio >= 4.5 ? 'Good' : 'Low Contrast'} · {ratio.toFixed(1)}:1</span></header>
    <div className="cts-segments" role="group" aria-label={`${label} Fill`}>
      {(['solid', 'gradient', 'glass'] as const).map((kind) => <button type="button" key={kind} className={value.fill.kind === kind ? 'is-active' : ''} onClick={() => setKind(kind)}>{kind.toUpperCase()}</button>)}
    </div>
    {value.fill.kind === 'solid' && <>{colorControl('Color', 'solid', value.fill.color, (color) => updateFill({ color }))}{range('Background Alpha', value.fill.alpha, .14, 1, .01, setOpacity)}</>}
    {value.fill.kind === 'gradient' && <>{colorControl('Color A', 'gradientA', value.fill.colorA, (colorA) => updateFill({ colorA }))}{colorControl('Color B', 'gradientB', value.fill.colorB, (colorB) => updateFill({ colorB }))}{range('Opacity', opacityValue, 0, 1, .01, setOpacity)}</>}
    {value.fill.kind === 'glass' && <>{colorControl('Base Color', 'glassBase', value.fill.baseColor, (baseColor) => updateFill({ baseColor }))}{range('Background Alpha', value.fill.alpha, .14, .82, .01, setOpacity)}</>}
    <button type="button" className="cts-advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((openState) => !openState)}>{advancedOpen ? 'Hide appearance' : 'More appearance'}</button>
    {advancedOpen && <div className="cts-advanced">
      {value.fill.kind === 'gradient' && <>{range('Angle', value.fill.angle, 0, 360, 1, (angle) => updateFill({ angle }))}{range('Stop A', value.fill.stopA, 0, 100, 1, (stopA) => updateFill({ stopA }))}{range('Stop B', value.fill.stopB, 0, 100, 1, (stopB) => updateFill({ stopB }))}{range('Alpha B', value.fill.alphaB, 0, 1, .01, (alphaB) => updateFill({ alphaB }))}</>}
      {value.fill.kind === 'glass' && <>{range('Backdrop Blur', value.fill.blur, 0, 28, 1, (blur) => updateFill({ blur }))}{range('Saturation', value.fill.saturation, .8, 1.25, .01, (saturation) => updateFill({ saturation }))}{colorControl('Glass Border', 'border', value.fill.borderColor, (borderColor) => updateFill({ borderColor }))}{range('Glass Border Alpha', value.fill.borderAlpha, 0, 1, .01, (borderAlpha) => updateFill({ borderAlpha }))}{range('Glass Border Width', value.fill.borderWidth, 0, 4, .5, (borderWidth) => updateFill({ borderWidth }))}</>}
      {colorControl('Text Color', 'text', value.textColor, (textColor) => onChange({ ...value, textColor }))}
      <button type="button" className="cts-auto-contrast" onClick={() => onChange({ ...value, textColor: contrastRatio('#FFFFFF', approximate) >= contrastRatio('#171515', approximate) ? '#FFFFFF' : '#171515' })}>Auto Contrast</button>
      {colorControl('Border Color', 'border', value.borderColor, (borderColor) => onChange({ ...value, borderColor }))}
      {range('Border Alpha', value.borderAlpha, 0, 1, .01, (borderAlpha) => onChange({ ...value, borderAlpha }))}
      {range('Border Width', value.borderWidth, 0, 4, .5, (borderWidth) => onChange({ ...value, borderWidth }))}
      {range('Radius', value.radius, 4, 28, 1, (radius) => onChange({ ...value, radius }))}
    </div>}
  </section>;
}

export function ChatThemeStudio({ open, onClose, seed = null, openPaletteMapping = false }: Props) {
  const currentTheme = useChatThemeStore((state) => state.currentTheme);
  const savedThemes = useChatThemeStore((state) => state.savedThemes);
  const recentColors = useChatThemeStore((state) => state.recentColors);
  const updateCurrent = useChatThemeStore((state) => state.updateCurrent);
  const setCurrent = useChatThemeStore((state) => state.setCurrent);
  const rememberColor = useChatThemeStore((state) => state.rememberColor);
  const stashItems = useRuneStashStore((state) => state.items);
  const [tab, setTab] = useState<'myBubble' | 'agentBubble' | 'background' | 'saved' | 'skin'>('myBubble');
  const [picker, setPicker] = useState<{ target: Target | 'theme'; field: ColorField } | null>(null);
  const [search, setSearch] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mapping, setMapping] = useState<string[]>([]);
  const [draftTheme, setDraftTheme] = useState<ChatTheme | null>(null);
  const [seedCleared, setSeedCleared] = useState(false);
  const [skinDraft, setSkinDraft] = useState<ChatBubbleSkin>({ mode: 'css' });
  const [skinBaseline, setSkinBaseline] = useState<ChatBubbleSkin | undefined>();
  const studioRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    // The blocking Studio consumes the entire canonical app canvas, so there
    // is no legal relocation target. Use the existing transient overlay seam;
    // persisted position and page-level visibility policy remain untouched.
    useCompanionPetStore.getState().setTransientHidden(true);
    return () => useCompanionPetStore.getState().setTransientHidden(false);
  }, [open]);
  useEffect(() => {
    if (!open || !seed) { setDraftTheme(null); return; }
    const colors = seed.colors.filter(validHex).map((color) => color.toUpperCase());
    if (!colors.length) { setDraftTheme(null); return; }
    const draft = structuredClone(useChatThemeStore.getState().currentTheme);
    draft.id = crypto.randomUUID();
    draft.name = 'Rune Stash Draft';
    draft.runeDefault = false;
    draft.updatedAt = Date.now();
    draft.myBubble = { ...draft.myBubble, fill: colors.length === 1
      ? { kind: 'solid', color: colors[0], alpha: 1 }
      : { kind: 'gradient', colorA: colors[0], colorB: colors[1], angle: 135, stopA: 0, stopB: 100, alphaA: .9, alphaB: .9 } };
    setDraftTheme(draft);
    setSeedCleared(false);
    setTab('myBubble');
    setMapping(colors);
    setPaletteOpen(openPaletteMapping);
  }, [open, seed, openPaletteMapping]);
  useEffect(() => {
    if (!open) return;
    const canonical = useChatThemeStore.getState().currentTheme.bubbleSkin;
    setSkinBaseline(canonical ? structuredClone(canonical) : undefined);
    setSkinDraft(canonical ? structuredClone(canonical) : { mode: 'css' });
  }, [open]);
  useEffect(() => { if (!open) return; studioRef.current?.querySelector<HTMLElement>('button,input,select')?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { picker ? setPicker(null) : closeRef.current(); return; } if (event.key !== 'Tab') return; const focusable=Array.from(studioRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')||[]).filter((node)=>node.offsetParent!==null); if (!focusable.length) return; const first=focusable[0],last=focusable[focusable.length-1]; if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();} }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [open, picker]);
  const colors = useMemo(() => stashItems.filter((item) => item.type === 'color'), [stashItems]);
  const palettes = useMemo(() => stashItems.filter((item): item is RuneStashPaletteItem => item.type === 'palette'), [stashItems]);
  const filteredColors = colors.filter((item) => `${item.title || ''} ${item.value} ${item.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  if (!open) return null;
  const baseTheme = draftTheme ?? currentTheme;
  const theme = tab === 'skin' ? { ...baseTheme, bubbleSkin: skinDraft } : baseTheme;
  const patchTheme = (patch: Partial<Pick<ChatTheme, 'myBubble' | 'agentBubble' | 'background' | 'accent'>>) => {
    if (!seed) { updateCurrent(patch); return; }
    setDraftTheme((value) => value ? { ...value, ...patch, updatedAt: Date.now() } : value);
  };
  const applyColor = (color: string) => {
    rememberColor(color);
    if (!picker) return;
    if (picker.target === 'theme') {
      if (picker.field === 'background') patchTheme({ background: { mode: 'solid', color } });
      if (picker.field === 'accent') patchTheme({ accent: color });
    } else {
      const style = theme[picker.target];
      if (picker.field === 'text') patchTheme({ [picker.target]: { ...style, textColor: color } });
      else if (picker.field === 'border') patchTheme({ [picker.target]: { ...style, borderColor: color } });
      else if (style.fill.kind === 'solid') patchTheme({ [picker.target]: { ...style, fill: { ...style.fill, color } } });
      else if (style.fill.kind === 'gradient') patchTheme({ [picker.target]: { ...style, fill: { ...style.fill, [picker.field === 'gradientB' ? 'colorB' : 'colorA']: color } } });
      else patchTheme({ [picker.target]: { ...style, fill: { ...style.fill, baseColor: color } } });
    }
    setPicker(null);
  };
  const choosePalette = (item: RuneStashPaletteItem) => { setPaletteOpen(true); setMapping(item.colorIds.map((id) => colors.find((color) => color.id === id)?.value).filter(Boolean) as string[]); };
  const applyPalette = () => {
    if (!mapping.length) return;
    const at = (index: number) => mapping[index % mapping.length];
    patchTheme({ background: { mode: 'solid', color: at(0) }, myBubble: { ...theme.myBubble, fill: { kind: 'gradient', colorA: at(1), colorB: at(2), angle: 135, stopA: 0, stopB: 100, alphaA: .9, alphaB: .9 } }, agentBubble: { ...theme.agentBubble, fill: { kind: 'solid', color: at(3), alpha: .82 } }, accent: at(4) });
    setPaletteOpen(false);
  };
  return createPortal(<div className="cts-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={studioRef} className={`cts-studio${tab === 'skin' ? ' is-skin-tab' : ''}`} role="dialog" aria-modal="true" aria-label="Chat Theme Studio" data-pet-safe-region="critical">
      <header className="cts-header"><div><small>Rune Chat Theme</small><h2>Bubble Studio</h2>{seed && !seedCleared && <p className="cts-provenance">來自 Rune Stash · {seed.colors.map((hex) => colors.find((item) => item.value.toUpperCase() === hex)?.title || hex).join(' · ')}</p>}</div><button type="button" onClick={onClose} aria-label="關閉">×</button></header>
      <div className="cts-layout">
        <div className="cts-controls">
          <nav className="cts-tabs" aria-label="Theme sections">{([['myBubble','My Bubble'],['agentBubble','Agent Bubble'],['background','Background'],['skin','氣泡外觀'],['saved','Saved Themes']] as const).map(([id,label]) => <button type="button" key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
          {seed && <div className="cts-seed-actions"><button type="button" onClick={() => { const original=structuredClone(useChatThemeStore.getState().currentTheme); setDraftTheme(original); setMapping([]); setPaletteOpen(false); setSeedCleared(true); }}>清除帶入色</button><button type="button" className="is-primary" onClick={() => { if (draftTheme) setCurrent(draftTheme); onClose(); }}>套用主題</button></div>}
          {tab === 'myBubble' && <BubbleControls label="My Bubble" value={theme.myBubble} onChange={(myBubble) => patchTheme({ myBubble })} onChoose={(field) => setPicker({ target: 'myBubble', field })}/>}
          {tab === 'agentBubble' && <BubbleControls label="Agent Bubble" value={theme.agentBubble} onChange={(agentBubble) => patchTheme({ agentBubble })} onChoose={(field) => setPicker({ target: 'agentBubble', field })}/>}
          {tab === 'background' && <section className="cts-bubble-section"><h3>Background</h3><div className="cts-segments"><button type="button" className={theme.background.mode === 'current' ? 'is-active' : ''} onClick={() => patchTheme({ background: { ...theme.background, mode: 'current' } })}>Use current Chat background</button><button type="button" className={theme.background.mode === 'solid' ? 'is-active' : ''} onClick={() => patchTheme({ background: { ...theme.background, mode: 'solid' } })}>Solid color</button></div>{theme.background.mode === 'solid' && <div className="cts-color-control"><label><span>Background Color</span><input aria-label="Background Color HEX" value={theme.background.color} onChange={(event) => patchTheme({ background: { mode: 'solid', color: event.target.value.toUpperCase() } })}/></label><button type="button" onClick={() => setPicker({ target: 'theme', field: 'background' })}>Choose from Rune Stash</button></div>}<p className="cts-approx">Wallpaper contrast is marked as approximate; dynamic image pixels are not sampled.</p></section>}
          {tab === 'skin' && <BubbleSkinStudioSection value={skinDraft} savedSkin={skinBaseline} onDraft={setSkinDraft} onCancel={() => setSkinDraft(skinBaseline ? structuredClone(skinBaseline) : { mode: 'css' })} onSave={() => { const saved = structuredClone(skinDraft); updateCurrent({ bubbleSkin: saved }); setSkinBaseline(saved); }}/>}
          {tab === 'saved' && <section className="cts-saved">
            <div className="cts-presets" role="group" aria-label="Curated presets">
              <h4>Curated Presets</h4>
              <div className="cts-preset-grid">
                {CURATED_CHAT_THEME_PRESETS.map((preset) => <button type="button" key={preset.id} className="cts-preset-card" onClick={() => seed ? setDraftTheme(preset.create()) : useChatThemeStore.getState().setCurrent(preset.create())}>
                  <strong>{preset.label}</strong>
                  <small>Apply as editable seed</small>
                </button>)}
              </div>
            </div>
            <button type="button" onClick={() => { if (seed && draftTheme) setCurrent(draftTheme); useChatThemeStore.getState().save(prompt('Theme name') || undefined); if (seed) onClose(); }}>Save current theme</button><button type="button" onClick={() => seed ? setDraftTheme(CURATED_CHAT_THEME_PRESETS[0].create()) : useChatThemeStore.getState().reset()}>Reset to Rune Default</button>{savedThemes.map((savedTheme) => <article key={savedTheme.id}><strong>{savedTheme.name}</strong><div><button type="button" onClick={() => useChatThemeStore.getState().setActive(savedTheme.id)}>Set Active</button><button type="button" onClick={() => useChatThemeStore.getState().duplicate(savedTheme.id)}>Duplicate</button><button type="button" onClick={() => useChatThemeStore.getState().rename(savedTheme.id, prompt('New name', savedTheme.name) || savedTheme.name)}>Rename</button><button type="button" onClick={() => useChatThemeStore.getState().deleteTheme(savedTheme.id)}>Delete</button></div></article>)}</section>}
        </div>
        <aside className="cts-preview" aria-label="Live preview" style={chatThemeStyle(theme)} data-chat-theme-active={theme.runeDefault ? undefined : 'true'}><header><span>Live Preview</span><small>{theme.name}</small></header><BubbleSkinPreviewContext.Provider value={theme}><div className="cts-preview-messages">{previewMessages.map((message) => <MessageBubble key={message.id} message={message} position="only" showTime showAvatar allMessages={previewMessages as Message[]}/>)}</div></BubbleSkinPreviewContext.Provider></aside>
      </div>
      {picker && <div className="cts-picker" role="dialog" aria-modal="true" aria-label="Choose from Rune Stash" data-pet-safe-region="critical"><header><h3>Choose from Rune Stash</h3><button type="button" onClick={() => setPicker(null)} aria-label="關閉 Stash picker">×</button></header><input autoFocus aria-label="Search Rune Stash" placeholder="Search name, HEX, tag" value={search} onChange={(event) => setSearch(event.target.value)}/>{recentColors.length > 0 && <section><h4>Recently Used</h4><div className="cts-swatches">{recentColors.map((color) => <button type="button" key={color} onClick={() => applyColor(color)} style={{ background: color }} aria-label={`Use ${color}`}/>)}</div></section>}<section><h4>Colors</h4><div className="cts-color-list">{filteredColors.map((item) => <button type="button" key={item.id} onClick={() => applyColor(item.value)}><i style={{ background: item.value }}/><span>{item.title || item.value}<small>{item.value} {item.tags.map((tag) => `#${tag}`).join(' ')}</small></span></button>)}</div></section><section><h4>Palettes</h4>{palettes.map((item) => <button className="cts-palette-row" type="button" key={item.id} onClick={() => choosePalette(item)}>{item.title || item.value}</button>)}</section></div>}
      {paletteOpen && mapping.length > 0 && <div className="cts-mapping" role="dialog" aria-modal="true" aria-label="Palette mapping" data-pet-safe-region="critical"><h3>Palette Mapping</h3>{['Background','My Bubble A','My Bubble B','Agent Bubble','Accent'].map((label,index) => <label key={label}><span>{label}</span><select value={mapping[index % mapping.length]} onChange={(event) => setMapping((values) => { const next=[...values]; next[index]=event.target.value; return next; })}>{mapping.map((color) => <option key={color}>{color}</option>)}</select></label>)}<div><button type="button" onClick={() => setPaletteOpen(false)}>Cancel</button><button type="button" onClick={applyPalette}>Apply</button></div></div>}
    </section>
  </div>, document.body);
}
