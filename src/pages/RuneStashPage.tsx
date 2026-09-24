import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppIcon } from '@/components/icons/AppIcon';
import { RuneInlineDelete } from '@/components/ui/rune';
import { ColorLab } from '@/components/stash/ColorLab';
import { ColorCollectionDetail, ColorCollectionEditor, ColorCollectionImportDialog, ColorCollectionPreview } from '@/components/stash/ColorCollectionBoard';
import { useToastStore } from '@/store/useToastStore';
import { createChatThemeDraftSeed, type StashChatThemeNavigationState } from '@/features/stash/chatThemeDraftBridge';
import {
  mixHexColors,
  suggestStashType,
  useRuneStashStore,
  type RuneStashDraft,
  type RuneStashColorCollectionItem,
  type RuneStashItem,
  type RuneStashPaletteItem,
  type StashItemType,
} from '@/features/stash/useRuneStashStore';
import './RuneStashPage.css';

type StashFilter = 'all' | 'favorites' | StashItemType;

const TABS: { id: StashFilter; label: string }[] = [
  { id: 'all', label: '全部' }, { id: 'favorites', label: '收藏' },
  { id: 'color', label: '色卡' }, { id: 'kaomoji', label: '顏文字' },
  { id: 'symbol', label: '符號' }, { id: 'text', label: '文字' },
  { id: 'palette', label: '配色' },
  { id: 'color_collection', label: '配色集' },
];
const KAOMOJI_GROUPS = [{id:'Happy',label:'開心'},{id:'Cry',label:'哭泣'},{id:'Sad',label:'難過'},{id:'Angry',label:'生氣'},{id:'Embarrassed',label:'害羞'},{id:'Love',label:'喜愛'},{id:'Confused',label:'困惑'},{id:'Shock',label:'震驚'}];
const TYPES: { id: StashItemType; label: string }[] = [
  { id: 'color', label: '顏色' }, { id: 'kaomoji', label: '顏文字' }, { id: 'symbol', label: '特殊符號' },
  { id: 'text', label: '短文字' }, { id: 'palette', label: '配色' },
];

const isHex = (value: string) => /^#[0-9A-F]{6}$/i.test(value.trim());
const tagsFromInput = (value: string) => value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function ItemActions({ item, onEdit, onDelete, onAddToPalette, onMix, onDesignBubble, onDesignTheme }: {
  item: RuneStashItem;
  onEdit: () => void;
  onDelete: () => void;
  onAddToPalette?: () => void;
  onMix?: () => void;
  onDesignBubble?: () => void;
  onDesignTheme?: () => void;
}) {
  const toggleFavorite = useRuneStashStore((state) => state.toggleFavorite);
  const [open, setOpen] = useState(false);
  return <div className={`stash-item-actions${open ? ' is-open' : ''}`} onClick={(event) => event.stopPropagation()} data-pet-safe-region="stash-actions">
    <button type="button" className="stash-overflow-trigger" onClick={() => setOpen(true)} aria-label="更多操作" aria-haspopup="menu" aria-expanded={open}>•••</button>
    {open && <div className="stash-action-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="stash-action-menu" role="menu" aria-label={(item.title || item.value) + ' 操作'} data-pet-safe-region="stash-context-menu">
        <div className="stash-action-menu-head"><strong>{item.title || item.value}</strong><button type="button" onClick={() => setOpen(false)} aria-label="關閉操作選單">×</button></div>
        <button type="button" role="menuitem" onClick={() => { toggleFavorite(item.id); setOpen(false); }}>{item.favorite ? '取消收藏' : '加入收藏'}</button>
        <button type="button" role="menuitem" onClick={() => { onEdit(); setOpen(false); }}>編輯</button>
        {onAddToPalette && <button type="button" role="menuitem" onClick={() => { onAddToPalette(); setOpen(false); }}>加入配色</button>}
        {onMix && <button type="button" role="menuitem" onClick={() => { onMix(); setOpen(false); }}>加入混色器</button>}
        {onDesignBubble && <button type="button" role="menuitem" onClick={() => { onDesignBubble(); setOpen(false); }}>設計聊天氣泡</button>}
        {onDesignTheme && <button type="button" role="menuitem" onClick={() => { onDesignTheme(); setOpen(false); }}>設計聊天主題</button>}
        <RuneInlineDelete label="刪除" confirmLabel="確認" triggerRole="menuitem" onConfirm={() => { onDelete(); setOpen(false); }} />
      </div>
    </div>}
  </div>;
}

function StashDialog({ editing, initialType, colors, onClose }: {
  editing: RuneStashItem | null;
  initialType?: StashItemType;
  colors: RuneStashItem[];
  onClose: () => void;
}) {
  const addItem = useRuneStashStore((state) => state.addItem);
  const updateItem = useRuneStashStore((state) => state.updateItem);
  const initialPaletteIds = editing?.type === 'palette' ? editing.colorIds : [];
  const [type, setType] = useState<StashItemType>(editing?.type || initialType || 'text');
  const [value, setValue] = useState(editing?.value || '');
  const [title, setTitle] = useState(editing?.title || '');
  const [tags, setTags] = useState(editing?.tags.join(', ') || '');
  const [note, setNote] = useState(editing?.note || '');
  const [colorIds, setColorIds] = useState<string[]>(initialPaletteIds);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(editing?.title || editing?.tags.length || editing?.note));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = type === 'palette' ? Boolean((title || value).trim() && colorIds.length) : Boolean(value.trim()) && (type !== 'color' || isHex(value));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const draft: RuneStashDraft = { type, value: type === 'palette' ? (title || value) : value, title, tags: tagsFromInput(tags), note, colorIds };
    if (editing) updateItem(editing.id, draft); else addItem(draft);
    onClose();
  };

  return <div className="stash-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="stash-dialog stash-quick-float" role="dialog" aria-modal="true" aria-labelledby="stash-dialog-title" onSubmit={submit} data-pet-safe-region="stash-quick-float">
      <header><div><span className="stash-eyebrow">RUNE STASH</span><h2 id="stash-dialog-title">{editing ? '編輯素材' : '快速新增'}</h2></div><button type="button" className="stash-close" onClick={onClose} aria-label="關閉">×</button></header>
      <div className="stash-float-body">
        <label>{type === 'palette' ? '名稱' : type === 'color' ? 'HEX' : '內容'}
          <input ref={inputRef} value={type === 'palette' ? title : value} onChange={(event) => {
            const next = event.target.value;
            if (type === 'palette') setTitle(next); else {
              setValue(next);
              if (!editing && type === 'text') { const suggested = suggestStashType(next); setType(suggested === 'color' ? 'text' : suggested); }
            }
          }} placeholder={type === 'color' ? '#F4E9DC' : type === 'palette' ? '月光' : '保存一小段素材'} />
        </label>
        <label>類型<select value={type} onChange={(event) => setType(event.target.value as StashItemType)} disabled={Boolean(editing)}>{TYPES.filter((option) => option.id !== 'color' || editing?.type === 'color').map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        {type === 'color' && <div className="stash-type-preview stash-type-preview--color"><input aria-label="選擇顏色" type="color" value={isHex(value) ? value : '#F4E9DC'} onChange={(event) => setValue(event.target.value.toUpperCase())} /><span style={{ background: isHex(value) ? value : '#F4E9DC' }} /><code>{isHex(value) ? value.toUpperCase() : 'HEX 預覽'}</code></div>}
        {(type === 'kaomoji' || type === 'symbol') && <output className={'stash-type-preview stash-type-preview--' + type} aria-label={type + ' preview'}>{value || (type === 'kaomoji' ? '( ˶ˆᗜˆ˵ )' : '✦')}</output>}
        {type === 'palette' && <fieldset><legend>色卡</legend><div className="stash-color-picker">{colors.map((color) => <label key={color.id}><input type="checkbox" checked={colorIds.includes(color.id)} onChange={() => setColorIds((ids) => ids.includes(color.id) ? ids.filter((id) => id !== color.id) : [...ids, color.id])} /><span style={{ background: color.value }} /><b>{color.title || color.value}</b></label>)}</div>{!colors.length && <p>先儲存至少一個色卡。</p>}</fieldset>}
        <button type="button" className="stash-more-details" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen}>{detailsOpen ? '收起詳細資料' : '更多詳細資料'}<span aria-hidden="true">⌄</span></button>
        {detailsOpen && <div className="stash-extra-fields">
          {type !== 'palette' && <label>名稱 <small>選填</small><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>}
          <label>標籤 <small>選填，逗號分隔</small><input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
          <label>備註 <small>選填</small><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></label>
        </div>}
        {type === 'color' && value && !isHex(value) && <p className="stash-field-error">請輸入完整 HEX，例如 #F4E9DC。</p>}
      </div>
      <footer><button type="button" onClick={onClose}>取消</button><button type="submit" className="is-primary" disabled={!valid}>儲存</button></footer>
    </form>
  </div>;
}

function MixerDialog({ colors, seed, onClose }: { colors: RuneStashItem[]; seed?: string; onClose: () => void }) {
  const addItem = useRuneStashStore((state) => state.addItem);
  const [a, setA] = useState(seed && isHex(seed) ? seed : colors[0]?.value || '#F4E9DC');
  const [b, setB] = useState(colors[1]?.value || '#8DB8D8');
  const [ratio, setRatio] = useState(50);
  const result = mixHexColors(a, b, ratio / 100);
  return <div className="stash-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="stash-dialog stash-mixer" role="dialog" aria-modal="true" aria-labelledby="stash-mixer-title" data-pet-safe-region="stash-mixer">
    <header><div><span className="stash-eyebrow">雙色工具</span><h2 id="stash-mixer-title">混色</h2></div><button type="button" className="stash-close" onClick={onClose} aria-label="關閉">×</button></header>
    <div className="stash-mixer-inputs"><label>顏色 A<input type="color" value={a} onChange={(e) => setA(e.target.value.toUpperCase())} /><code>{a}</code></label><label>顏色 B<input type="color" value={b} onChange={(e) => setB(e.target.value.toUpperCase())} /><code>{b}</code></label></div>
    <label>比例 · {ratio}%<input type="range" min="0" max="100" value={ratio} onChange={(e) => setRatio(Number(e.target.value))} /></label>
    <div className="stash-mix-result"><span style={{ background: result }} /><div><small>結果</small><strong>{result}</strong></div></div>
    <footer><button type="button" onClick={onClose}>取消</button><button type="button" className="is-primary" onClick={() => { addItem({ type: 'color', value: result, title: '混合色', tags: ['mixed'] }); onClose(); }}>儲存色卡</button></footer>
  </section></div>;
}

function PaletteCard({ item, colorMap, onCopy, onEdit, onDelete, onDesignTheme }: { item: RuneStashPaletteItem; colorMap: Map<string, RuneStashItem>; onCopy: (value: string, id: string) => void; onEdit: () => void; onDelete: () => void; onDesignTheme: () => void }) {
  const reorder = useRuneStashStore((state) => state.reorderPalette);
  const hexes = item.colorIds.map((id) => colorMap.get(id)?.value).filter(Boolean) as string[];
  return <article className="stash-palette-card" data-stash-id={item.id} data-pet-safe-region="stash-card">
    <div className="stash-palette-strip">{hexes.map((hex, index) => <span key={`${hex}-${index}`} style={{ background: hex }} title={hex} />)}</div>
    <h3>{item.title || item.value}</h3><p>{hexes.join(' · ') || '沒有色卡'}</p>
    <div className="stash-palette-buttons"><button onClick={() => onCopy(hexes.join(' '), item.id)}>複製 HEX 清單</button><button onClick={() => onCopy(hexes.map((hex, i) => `--stash-color-${i + 1}: ${hex};`).join('\n'), item.id)}>複製 CSS 變數</button></div>
    <div className="stash-palette-order">{hexes.map((hex, index) => <span key={`${hex}-move`}><button disabled={index === 0} onClick={() => reorder(item.id, index, index - 1)}>←</button><i style={{ background: hex }} /><button disabled={index === hexes.length - 1} onClick={() => reorder(item.id, index, index + 1)}>→</button></span>)}</div>
    <ItemActions item={item} onEdit={onEdit} onDelete={onDelete} onDesignTheme={onDesignTheme} />
  </article>;
}

export function RuneStashPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnedContext = (location.state as { stashContext?: StashChatThemeNavigationState['stashContext'] } | null)?.stashContext;
  const items = useRuneStashStore((state) => state.items);
  const deleteItem = useRuneStashStore((state) => state.deleteItem);
  const showToast = useToastStore((state) => state.showToast);
  const [filter, setFilter] = useState<StashFilter>(() => returnedContext?.filter === 'color' ? 'color' : 'all');
  const [initialColorWorkspace] = useState<'lab' | 'library' | 'palettes'>(() => returnedContext ? (returnedContext.workspaceTab === 'palettes' ? 'palettes' : 'library') : 'lab');
  const [group, setGroup] = useState<string>('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<RuneStashItem | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<StashItemType | undefined>();
  const [mixerSeed, setMixerSeed] = useState<string | null>(null);
  const [collectionEditor, setCollectionEditor] = useState<RuneStashColorCollectionItem | null | undefined>(undefined);
  const [openCollectionId, setOpenCollectionId] = useState<string | null>(null);
  const [collectionImportOpen, setCollectionImportOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [colorFocusSignal, setColorFocusSignal] = useState(0);
  const copyTimer = useRef<number | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const colors = useMemo(() => items.filter((item) => item.type === 'color'), [items]);
  const colorMap = useMemo(() => new Map(colors.map((color) => [color.id, color])), [colors]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => items.filter((item) => {
    if (filter === 'favorites' && !item.favorite) return false;
    if (filter !== 'all' && filter !== 'favorites' && item.type !== filter) return false;
    if (group && !item.tags.some((tag) => tag.toLocaleLowerCase() === group.toLocaleLowerCase())) return false;
    if (!normalizedQuery) return true;
    const paletteColors = item.type === 'palette' ? item.colorIds.map((id) => colorMap.get(id)?.value || '').join(' ') : '';
    const collectionColors = item.type === 'color_collection' ? item.swatches.map((swatch) => `${swatch.name} ${swatch.hex} ${swatch.note || ''}`).join(' ') : '';
    return [item.value, item.title, item.note, item.tags.join(' '), paletteColors, collectionColors].join(' ').toLocaleLowerCase().includes(normalizedQuery);
  }), [colorMap, filter, group, items, normalizedQuery]);

  useEffect(() => () => { if (copyTimer.current !== null) window.clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    if (!returnedContext) return;
    requestAnimationFrame(() => window.scrollTo({ top: returnedContext.scrollY, behavior: 'auto' }));
    navigate('/stash', { replace: true, state: null });
  }, [navigate, returnedContext]);
  const handleCopy = async (value: string, id: string) => {
    try {
      await copyText(value);
      setCopiedId(id);
      showToast('✓ 已複製');
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedId(null), 850);
    } catch { showToast('複製失敗'); }
  };
  const deleteStashItem = (item: RuneStashItem) => deleteItem(item.id);
  const confirmColorDelete = (item: RuneStashItem) => {
    if (window.confirm(`刪除 ${item.title || item.value}？`)) deleteItem(item.id);
  };
  const openAdd = (type?: StashItemType) => { setComposerType(type); setComposerOpen(true); };
  const selectTab = (tab: StashFilter, index: number) => {
    setFilter(tab);
    if (tab !== 'kaomoji') setGroup('');
    tabRefs.current[index]?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
  };
  const handleTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    selectTab(TABS[nextIndex].id, nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  const addColorToPalette = (color: RuneStashItem) => { const palette = items.find((item): item is RuneStashPaletteItem => item.type === 'palette'); if (!palette) { openAdd('palette'); return; } useRuneStashStore.getState().updateItem(palette.id, { colorIds: [...palette.colorIds, color.id] }); showToast('已加入配色'); };
  const openChatThemeDraft = (hexes: string[], workspaceTab: 'library' | 'palettes', openPaletteMapping = false) => {
    const chatThemeDraftSeed = createChatThemeDraftSeed(hexes);
    if (!chatThemeDraftSeed) { showToast('沒有可帶入的有效色彩'); return; }
    navigate('/chat/theme-studio', { state: { chatThemeDraftSeed, openPaletteMapping, returnTo: '/stash', stashContext: { filter: 'color', workspaceTab, scrollY: window.scrollY } } satisfies StashChatThemeNavigationState });
  };
  return <main className="stash-page" data-testid="rune-stash-page">
    <header className="stash-header" data-pet-safe-region="critical"><span className="stash-eyebrow">私人素材庫</span><div className="stash-title-row"><h1>Rune Stash</h1><div className="stash-title-actions">{filter === 'color_collection' && <button type="button" className="stash-import" onClick={() => setCollectionImportOpen(true)}>匯入色卡集</button>}<button type="button" className="stash-add" onClick={() => { if (filter === 'color') setColorFocusSignal((value) => value + 1); else if (filter === 'color_collection') setCollectionEditor(null); else openAdd(); }} aria-label={filter === 'color_collection' ? '新增配色集' : '新增素材'}><span>＋</span><b>新增</b></button></div></div><p>保存那些之後還想再用的東西</p></header>
    <div className="stash-toolbar"><label className="stash-search"><span className="sr-only">搜尋</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋內容、名稱或標籤" /></label></div>
    <nav className="stash-tabs" aria-label="素材類型" role="tablist" data-pet-safe-region="stash-tabs">{TABS.map((tab, index) => <button ref={(node) => { tabRefs.current[index] = node; }} type="button" role="tab" key={tab.id} className={filter === tab.id ? 'is-active' : ''} aria-selected={filter === tab.id} tabIndex={filter === tab.id ? 0 : -1} onKeyDown={(event) => handleTabKey(event, index)} onClick={() => selectTab(tab.id, index)}>{tab.label}</button>)}</nav>
    {filter === 'kaomoji' && <div className="stash-groups" aria-label="顏文字分類"><button className={!group ? 'is-active' : ''} onClick={() => setGroup('')}>全部心情</button>{KAOMOJI_GROUPS.map(({id,label}) => <button key={id} className={group === id ? 'is-active' : ''} onClick={() => setGroup(id)}>{label}</button>)}</div>}
    {filter === 'color' ? <ColorLab colors={colors as import('@/features/stash/useRuneStashStore').RuneStashColorItem[]} palettes={items.filter((item): item is RuneStashPaletteItem => item.type === 'palette')} query={query} focusSignal={colorFocusSignal} initialTab={initialColorWorkspace} onCopy={handleCopy} onEdit={setEditing} onDelete={confirmColorDelete} onAddToPalette={addColorToPalette} onDesignBubble={(selected) => openChatThemeDraft(selected.map((item) => item.value), 'library')} onDesignPalette={(palette) => openChatThemeDraft(palette.colorIds.map((id) => colorMap.get(id)?.value || ''), 'palettes', true)} /> : !items.length ? <section className="stash-empty"><AppIcon name="archiveBox" size={32} /><h2>素材庫還是空的</h2><p>先保存一個色卡、顏文字、符號或短文字。</p><button type="button" onClick={() => openAdd()}>新增第一筆素材</button></section>
      : !filtered.length ? <section className="stash-empty"><h2>找不到符合的素材</h2><p>換個搜尋字或清除篩選。</p></section>
      : <section className={`stash-collection stash-collection--${filter}`} aria-live="polite">
        {filtered.map((item) => {
          if (item.type === 'color_collection') return <ColorCollectionPreview key={item.id} item={item} onOpen={() => setOpenCollectionId(item.id)} onEdit={() => setCollectionEditor(item)} onDelete={() => deleteStashItem(item)} />;
          if (item.type === 'palette') return <PaletteCard key={item.id} item={item} colorMap={colorMap} onCopy={handleCopy} onEdit={() => setEditing(item)} onDelete={() => deleteStashItem(item)} onDesignTheme={() => openChatThemeDraft(item.colorIds.map((id) => colorMap.get(id)?.value || ''), 'palettes', true)} />;
          const isColor = item.type === 'color';
          return <article key={item.id} className={`stash-item stash-item--${item.type}${copiedId === item.id ? ' is-copied' : ''}`} data-stash-id={item.id} data-pet-safe-region="stash-card" role="button" tabIndex={0} aria-label={`複製 ${item.title || item.value}`} onClick={() => handleCopy(item.value, item.id)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleCopy(item.value, item.id); } }}>
            {isColor && <span className="stash-swatch" style={{ background: item.value }} />}
            <div className="stash-item-copy">{item.title && <strong>{item.title}</strong>}<span className={item.type === 'kaomoji' ? 'stash-kaomoji' : item.type === 'symbol' ? 'stash-symbol' : ''}>{item.value}</span>{item.tags.length > 0 && <small>{item.tags.map((tag) => `#${tag}`).join(' ')}</small>}</div>
            <span className="stash-copy-state" aria-live="polite">{copiedId === item.id ? '✓ 已複製' : isColor ? item.value : '複製'}</span>
            <ItemActions item={item} onEdit={() => setEditing(item)} onDelete={() => deleteStashItem(item)} onAddToPalette={isColor ? () => openAdd('palette') : undefined} onMix={isColor ? () => setMixerSeed(item.value) : undefined} onDesignBubble={isColor ? () => openChatThemeDraft([item.value], 'library') : undefined} />
          </article>;
        })}
      </section>}
    {(composerOpen || editing) && <StashDialog editing={editing} initialType={composerType} colors={colors} onClose={() => { setEditing(null); setComposerOpen(false); setComposerType(undefined); }} />}
    {mixerSeed !== null && <MixerDialog colors={colors} seed={mixerSeed} onClose={() => setMixerSeed(null)} />}
    {collectionEditor !== undefined && <ColorCollectionEditor item={collectionEditor} onClose={() => setCollectionEditor(undefined)} />}
    {collectionImportOpen && <ColorCollectionImportDialog onClose={() => setCollectionImportOpen(false)} onSaved={(id) => { setCollectionImportOpen(false); setFilter('color_collection'); setOpenCollectionId(id); showToast('已匯入色卡集'); }} />}
    {openCollectionId && (() => { const collection = items.find((item): item is RuneStashColorCollectionItem => item.id === openCollectionId && item.type === 'color_collection'); return collection ? <ColorCollectionDetail item={collection} onClose={() => setOpenCollectionId(null)} onEdit={() => { setOpenCollectionId(null); setCollectionEditor(collection); }} /> : null; })()}
  </main>;
}
