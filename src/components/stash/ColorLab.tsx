import { useEffect, useRef, useState } from 'react';
import { ColorWheel } from './ColorWheel';
import { hexToHsv, hsvToHex, normalizeHex } from '@/features/stash/colorMath';
import { mixHexColors, useRuneStashStore, type RuneStashColorItem, type RuneStashPaletteItem } from '@/features/stash/useRuneStashStore';
import { useRuneStashUiStore } from '@/features/stash/useRuneStashUiStore';

type WorkspaceTab = 'lab' | 'library' | 'palettes';

export function ColorLab({ colors, palettes, query, onCopy, onEdit, onDelete, onAddToPalette, onDesignBubble, onDesignPalette, focusSignal, initialTab = 'lab' }: {
  colors: RuneStashColorItem[]; palettes: RuneStashPaletteItem[]; query: string;
  onCopy: (value: string, id: string) => void; onEdit: (item: RuneStashColorItem | RuneStashPaletteItem) => void; onDelete: (item: RuneStashColorItem | RuneStashPaletteItem) => void;
  onAddToPalette: (item: RuneStashColorItem) => void; onDesignBubble: (items: RuneStashColorItem[]) => void; onDesignPalette: (item: RuneStashPaletteItem) => void; focusSignal: number; initialTab?: WorkspaceTab;
}) {
  const addItem = useRuneStashStore((state) => state.addItem);
  const reorderPalette = useRuneStashStore((state) => state.reorderPalette);
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const [hsv, setHsv] = useState(() => hexToHsv('#5B717C'));
  const [hexDraft, setHexDraft] = useState('#5B717C');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [a, setA] = useState(colors[0]?.value || '#F4E9DC');
  const [b, setB] = useState(colors[1]?.value || '#8DB8D8');
  const [ratio, setRatio] = useState(50);
  const [actionItem, setActionItem] = useState<RuneStashColorItem | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const labRef = useRef<HTMLElement>(null);
  const previousFocusSignal = useRef(focusSignal);
  const viewMode = useRuneStashUiStore((state) => state.colorViewMode);
  const setViewMode = useRuneStashUiStore((state) => state.setColorViewMode);
  const currentHex = hsvToHex(hsv);
  const mixed = mixHexColors(a, b, ratio / 100);
  useEffect(() => {
    if (focusSignal === previousFocusSignal.current) return;
    previousFocusSignal.current = focusSignal;
    setTab('lab'); requestAnimationFrame(() => labRef.current?.focus());
  }, [focusSignal]);
  const setCurrent = (hex: string) => { const normalized = normalizeHex(hex); setHexDraft(hex.toUpperCase()); if (normalized) setHsv(hexToHsv(normalized)); };
  const save = () => { addItem({ type: 'color', value: currentHex, title: name, tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) }); setName(''); setTags(''); };
  const visibleColors = colors.filter((item) => [item.title, item.value, item.tags.join(' ')].join(' ').toLowerCase().includes(query.toLowerCase()));
  const toggleSelected = (item: RuneStashColorItem) => setSelectedIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : ids.length < 2 ? [...ids, item.id] : ids);
  const selectedColors = selectedIds.map((id) => colors.find((item) => item.id === id)).filter((item): item is RuneStashColorItem => Boolean(item));
  const leaveSelection = () => { setSelecting(false); setSelectedIds([]); };
  return <section className="stash-color-workspace" aria-label="色彩工作區">
    <nav className="stash-color-nav" aria-label="色彩工作區" role="tablist">{([['lab','調色台'],['library','色庫'],['palettes','配色']] as const).map(([id,label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === 'lab' && <section ref={labRef} tabIndex={-1} className="stash-lab" data-testid="color-lab">
      <div className="stash-lab-picker"><ColorWheel value={hsv} onChange={(next) => { setHsv(next); setHexDraft(hsvToHex(next)); }}/><div className="stash-color-numbers">
        <label>色相<input aria-label="色相" type="number" min="0" max="360" value={Math.round(hsv.h)} onChange={(e) => { const next={...hsv,h:Number(e.target.value)};setHsv(next);setHexDraft(hsvToHex(next)); }}/></label>
        <label>飽和度<input aria-label="飽和度" type="number" min="0" max="100" value={Math.round(hsv.s)} onChange={(e) => { const next={...hsv,s:Number(e.target.value)};setHsv(next);setHexDraft(hsvToHex(next)); }}/></label>
        <label>明度<input aria-label="明度" type="number" min="0" max="100" value={Math.round(hsv.v)} onChange={(e) => { const next={...hsv,v:Number(e.target.value)};setHsv(next);setHexDraft(hsvToHex(next)); }}/></label>
      </div></div>
      <div className="stash-current-color" data-pet-safe-region="critical"><span className="stash-current-preview" style={{ background: currentHex }}/><label>HEX<div><input aria-label="HEX" value={hexDraft} onChange={(e) => setCurrent(e.target.value)}/><button type="button" onClick={() => onCopy(currentHex, 'current-color')}>複製</button></div></label><label>名稱 <small>選填</small><input aria-label="名稱" value={name} onChange={(e) => setName(e.target.value)}/></label><label>標籤 <small>選填</small><input aria-label="標籤" value={tags} onChange={(e) => setTags(e.target.value)}/></label><button type="button" className="stash-save-color" onClick={save}>儲存色卡</button></div>
      <section className="stash-inline-mixer" data-pet-safe-region="critical"><h3>混色</h3><div><label>顏色 A<input aria-label="顏色 A" type="color" value={a} onChange={(e)=>setA(e.target.value.toUpperCase())}/><code>{a}</code></label><label>顏色 B<input aria-label="顏色 B" type="color" value={b} onChange={(e)=>setB(e.target.value.toUpperCase())}/><code>{b}</code></label></div><label>比例 <output>{ratio}%</output><input aria-label="混色比例" type="range" min="0" max="100" value={ratio} onChange={(e)=>setRatio(Number(e.target.value))}/></label><div className="stash-mix-result"><span style={{background:mixed}}/><strong>{mixed}</strong><button type="button" onClick={()=>setCurrent(mixed)}>使用結果</button></div></section>
    </section>}
    {tab === 'library' && <section><div className="stash-view-toggle" role="group" aria-label="色庫顯示方式"><button type="button" onClick={()=>{setSelecting(true);setSelectedIds([]);}}>選擇</button><button aria-pressed={viewMode==='tile'} onClick={()=>setViewMode('tile')}>色磚</button><button aria-pressed={viewMode==='compact'} onClick={()=>setViewMode('compact')}>緊湊</button></div>{selecting&&<div className="stash-selection-toolbar" data-pet-safe-region="critical"><strong>已選 {selectedIds.length} / 2</strong><button type="button" disabled={!selectedIds.length} onClick={()=>onDesignBubble(selectedColors)}>設計聊天氣泡</button><button type="button" onClick={leaveSelection}>取消</button></div>}<div className={`stash-color-library is-${viewMode}`}>{visibleColors.map((item)=><article key={item.id} className={`stash-color-card${selectedIds.includes(item.id)?' is-selected':''}`} data-stash-id={item.id} tabIndex={0} role="button" aria-pressed={selecting?selectedIds.includes(item.id):undefined} aria-label={`${selecting?'選擇':'複製'} ${item.title||item.value}`} onClick={()=>selecting?toggleSelected(item):onCopy(item.value,item.id)} onContextMenu={(e)=>{e.preventDefault();setActionItem(item)}}><span style={{background:item.value}}/><div>{item.title&&<strong>{item.title}</strong>}<code>{item.value}</code></div>{!selecting&&<button type="button" aria-label="更多操作" onClick={(e)=>{e.stopPropagation();setActionItem(item);}}>•••</button>}</article>)}</div>{actionItem&&<div className="stash-action-backdrop" onMouseDown={(e)=>e.target===e.currentTarget&&setActionItem(null)}><div className="stash-action-menu" role="menu" data-pet-safe-region="critical"><div className="stash-action-menu-head"><strong>{actionItem.title||actionItem.value}</strong><button onClick={()=>setActionItem(null)} aria-label="關閉操作選單">×</button></div><button role="menuitem" onClick={()=>{onEdit(actionItem);setActionItem(null)}}>編輯</button><button role="menuitem" onClick={()=>{useRuneStashStore.getState().toggleFavorite(actionItem.id);setActionItem(null)}}>{actionItem.favorite?'取消收藏':'加入收藏'}</button><button role="menuitem" onClick={()=>{onAddToPalette(actionItem);setActionItem(null)}}>加入配色</button><button role="menuitem" onClick={()=>{setA(actionItem.value);setTab('lab');setActionItem(null)}}>加入混色器 A</button><button role="menuitem" onClick={()=>{setB(actionItem.value);setTab('lab');setActionItem(null)}}>加入混色器 B</button><button role="menuitem" onClick={()=>{onDesignBubble([actionItem]);setActionItem(null)}}>設計聊天氣泡</button><button role="menuitem" className="is-danger" onClick={()=>{onDelete(actionItem);setActionItem(null)}}>刪除</button></div></div>}</section>}
    {tab === 'palettes' && <section className="stash-palette-library">{palettes.map((item)=>{const hexes=item.colorIds.map((id)=>colors.find((color)=>color.id===id)?.value).filter(Boolean) as string[];return <article key={item.id} className="stash-palette-card"><div className="stash-palette-strip">{hexes.map((hex)=><span key={hex} style={{background:hex}}/>)}</div><h3>{item.title||item.value}</h3><p>{hexes.join(' · ')}</p><div className="stash-palette-buttons"><button onClick={()=>onCopy(hexes.join(' '),item.id)}>複製 HEX 清單</button><button onClick={()=>onCopy(hexes.map((hex,i)=>`--stash-color-${i+1}: ${hex};`).join('\n'),item.id)}>複製 CSS 變數</button><button onClick={()=>onEdit(item)}>編輯</button><button onClick={()=>onDesignPalette(item)}>設計聊天主題</button></div><div className="stash-palette-order">{hexes.map((hex,index)=><span key={`${hex}-${index}`}><button disabled={!index} onClick={()=>reorderPalette(item.id,index,index-1)}>←</button><i style={{background:hex}}/><button disabled={index===hexes.length-1} onClick={()=>reorderPalette(item.id,index,index+1)}>→</button></span>)}</div><button className="is-danger" onClick={()=>onDelete(item)}>刪除</button></article>})}</section>}
  </section>;
}
