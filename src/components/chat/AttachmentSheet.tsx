import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { ClawdAsset, ClawdCategory } from '@/data/clawdAssetManifest';
import { ChatGachaPanel, type GachaContextPayload } from '@/components/chat/ChatGachaPanel';
import { usePetRecede } from '@/hooks/usePetRecede';
import { InteractiveIcon, InteractiveToolRegistry } from '@/features/interactive/InteractiveToolRegistry';
import type { InteractiveAttachment, InteractiveKind } from '@/features/interactive/types';
import { ChatInteractionWindow, InteractionWindowFooter, InteractionWindowHeader, InteractionWindowScrollBody } from './ChatInteractionWindow';

export interface ReferenceChip {
  id: string;
  icon: string;
  label: string;
  detail: string;
  text: string;
}

export type StickerPickPayload =
  | { url: string; name?: string; stickerId?: undefined; source?: undefined }
  | { url?: undefined; name?: undefined; stickerId: string; source: 'builtin' };

type AttachmentTab = 'image' | 'sticker' | 'interactive' | 'gacha';
export type AttachmentSheetView = 'launcher' | 'image' | 'sticker' | 'interaction';

interface AttachmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onImagePick: (file: File) => void;
  onStickerPick?: (opts: StickerPickPayload) => void;
  onGachaResult?: (payload: GachaContextPayload) => void;
  gachaContexts?: GachaContextPayload[];
  onRemoveGachaContext?: (index: number) => void;
  replaceTarget?: { index: number; title: string } | null;
  initialTab?: AttachmentTab;
  onInteractivePick?: (attachment: InteractiveAttachment) => void;
  currentCreatorIdentityId?: string;
}

type SegIcon = 'image' | 'sticker' | 'gacha' | 'interactive';
const SEGMENTS: Array<{ key: 'image' | 'sticker'; label: string; icon: SegIcon }> = [
  { key: 'image', label: '圖片', icon: 'image' },
  { key: 'sticker', label: '貼圖', icon: 'sticker' },
] as const;

function AttachmentIcon({ type }: { type: SegIcon }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (type === 'image') return <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden="true" {...c}><rect x="3" y="4" width="14" height="12" rx="3" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" /><path d="m17 12-3.5-3.5L7 16" /></svg>;
  if (type === 'sticker') return <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden="true" {...c}><rect x="3" y="3" width="14" height="14" rx="2" ry="2" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" /><path d="m17 12-3.5-3.5-3 3-1.2-1.2-3.5 3.5" /></svg>;
  if (type === 'gacha') return <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden="true" {...c}><circle cx="10" cy="8" r="5.5" /><circle cx="6.5" cy="14" r="2.5" /><path d="M10 11v5" /><circle cx="10" cy="17" r="1.2" fill="currentColor" /></svg>;
  if (type === 'interactive') return <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden="true" {...c}><rect x="3" y="3" width="14" height="14" rx="3"/><path d="M7 7h6M7 10h3M12 10h1M7 13h6"/></svg>;
  return null;
}

/* ── Image Drop Zone ── */
function ImagePicker({ onPick }: { onPick: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');

  const handleFile = (file?: File) => {
    setUploadError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setUploadError('僅支援 PNG、JPG、WebP');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('檔案大小上限 20 MB');
      return;
    }
    onPick(file);
  };

  return (
    <div className="pr-attach-body attachment-image-view">
      <button type="button" className="attachment-image-picker" onClick={() => inputRef.current?.click()}>
        <AttachmentIcon type="image" />
        <span>從相簿選取</span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { handleFile(event.target.files?.[0]); event.target.value = ''; }} />
      <p className="pr-drop-hint">PNG · JPG · WebP · 單檔上限 20 MB</p>
      {uploadError && <p className="pr-upload-error" role="alert">{uploadError}</p>}
    </div>
  );
}

/* ── Sticker Library ── */
function ClawdTile({ asset, onClick }: { asset: ClawdAsset; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button type="button" className="clawd-sticker-tile" onClick={onClick} aria-label={asset.label} title={asset.label}>
      {!loaded && !failed && <div className="clawd-sticker-skeleton" />}
      {failed ? (
        <svg className="clawd-sticker-fallback" viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" />
        </svg>
      ) : (
        <img src={asset.src} alt={asset.label} className={`clawd-sticker-img${loaded ? ' loaded' : ''}`} draggable={false} loading="lazy"
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={loaded ? undefined : { position: 'absolute', opacity: 0 }} />
      )}
      <span className="clawd-sticker-label">{asset.label}</span>
    </button>
  );
}

function StickerLibrary({ onPick, onClose }: { onPick: (opts: StickerPickPayload) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'clawd' | 'user'>('clawd');
  const [cat, setCat] = useState<ClawdCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [manifest, setManifest] = useState<readonly ClawdAsset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const packs = useAppStore(s => s.stickerPacks || []);
  const createPack = useAppStore(s => s.createStickerPack);
  const addSticker = useAppStore(s => s.addStickerToPack);
  const delSticker = useAppStore(s => s.deleteStickerFromPack);
  const fileRef = useRef<HTMLInputElement>(null);
  const [multiSelection, setMultiSelection] = useState<Set<string>>(new Set());

  const userPack = packs.find(p => p.owner === 'user' && p.name === 'My Stickers');
  const pid = userPack?.id;
  const allUser = packs.flatMap(p => p.stickers.map(s => ({ ...s, packId: p.id, packName: p.name })));

  useEffect(() => { if (tab === 'clawd' && !loaded) import('@/data/clawdAssetManifest').then(m => { setManifest(m.CLAWD_MANIFEST); setLoaded(true); }); }, [tab, loaded]);

  const filtered = useMemo(() => {
    if (!loaded) return [];
    if (cat !== 'all') {
      const byCat = manifest.filter(a => a.category === cat);
      return query ? byCat.filter(a => a.label.includes(query) || a.tags.some(t => t.includes(query))) : byCat;
    }
    return query ? manifest.filter(a => a.label.includes(query) || a.tags.some(t => t.includes(query))) : manifest;
  }, [manifest, cat, loaded, query]);

  const CATS: Array<{ v: ClawdCategory | 'all'; l: string }> = [
    { v: 'all', l: '全部' }, { v: 'emotion', l: '心情' }, { v: 'working', l: '工作' }, { v: 'action', l: '動作' },
    { v: 'sleep', l: '睡眠' }, { v: 'music', l: '音樂' }, { v: 'food', l: '飲食' }, { v: 'seasonal', l: '節日' }, { v: 'other', l: '其他' },
  ];

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const u = r.result as string; const t = pid || createPack('My Stickers', 'user'); addSticker(t, f.name.replace(/\.[^.]+$/, ''), u, undefined, f.type === 'image/gif' ? 'gif' : 'image'); };
    r.readAsDataURL(f); e.target.value = '';
  };

  return (
    <div className="pr-attach-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="pr-sticker-search">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="pr-search-icon-s">
          <circle cx="10.5" cy="10.5" r="6" /><line x1="15" y1="15" x2="21" y2="21" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜尋貼圖"
          className="pr-sticker-search-input"
        />
      </div>

      <div style={{ display: 'flex', gap: 2, background: 'var(--gacha-surface-muted)', borderRadius: 10, padding: 3, alignSelf: 'flex-start' }}>
        <button type="button" onClick={() => setTab('clawd')} style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', border: 'none', appearance: 'none', WebkitAppearance: 'none', background: tab === 'clawd' ? 'var(--gacha-surface)' : 'transparent', color: tab === 'clawd' ? 'var(--gacha-text)' : 'var(--gacha-text-muted)', boxShadow: tab === 'clawd' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>CLAWD</button>
        <button type="button" onClick={() => setTab('user')} style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', border: 'none', appearance: 'none', WebkitAppearance: 'none', background: tab === 'user' ? 'var(--gacha-surface)' : 'transparent', color: tab === 'user' ? 'var(--gacha-text)' : 'var(--gacha-text-muted)', boxShadow: tab === 'user' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>我的貼圖</button>
      </div>

      <div style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        {tab === 'user' && (
          <>
            <input ref={fileRef} type="file" accept="image/gif,image/png,image/jpeg,image/webp" hidden onChange={handleUpload} />
            <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px dashed var(--gacha-accent)', background: 'var(--gacha-accent-soft)', color: 'var(--gacha-accent)', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', flexShrink: 0, appearance: 'none', WebkitAppearance: 'none' }}>
              <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M8 2v12M2 8h12" /></svg>上傳
            </button>
          </>
        )}
        {tab === 'clawd' && (
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
            {CATS.map(c => (
              <button key={c.v} type="button" onClick={() => setCat(c.v)} style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', border: 'none', appearance: 'none', WebkitAppearance: 'none', background: cat === c.v ? 'var(--gacha-accent)' : 'var(--gacha-surface-muted)', color: cat === c.v ? 'var(--accent-fg, #fff)' : 'var(--gacha-text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{c.l}</button>
            ))}
          </div>
        )}
      </div>

      {tab === 'clawd' && (
        <div className="clawd-sticker-grid">
          {filtered.length === 0 && query ? (
            <p className="pr-empty-msg">沒有符合「{query}」的貼圖</p>
          ) : filtered.map(a => <ClawdTile key={a.id} asset={a} onClick={() => { onPick({ stickerId: a.id, source: 'builtin' }); onClose(); }} />)}
        </div>
      )}

      {tab === 'user' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {allUser.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: 24, color: 'var(--gacha-text-muted)', fontSize: 12 }}>尚無自定義貼圖，點擊上方「上傳」新增</p>
          ) : allUser.slice(0, 24).map(s => (
            <div key={s.id} style={{ position: 'relative' }}>
              <button type="button" onClick={() => { onPick({ url: s.url, name: s.name }); onClose(); }} style={{ width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--gacha-border)', background: 'var(--gacha-surface)', padding: 2, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
                <img src={s.url} alt={s.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AttachmentSheet({ isOpen, onClose, onImagePick, onStickerPick, onGachaResult, gachaContexts, onRemoveGachaContext, replaceTarget, initialTab, onInteractivePick, currentCreatorIdentityId }: AttachmentSheetProps) {
  const [view, setView] = useState<AttachmentSheetView>('launcher');
  const [selectedCount, setSelectedCount] = useState(0);
  const [configType, setConfigType] = useState<InteractiveKind | null>(null);
  const [showGacha, setShowGacha] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  usePetRecede(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      const initialView: AttachmentSheetView = initialTab === 'gacha' || initialTab === 'interactive'
        ? 'interaction'
        : initialTab || 'launcher';
      setView(initialView);
      setShowGacha(initialTab === 'gacha');
      setSelectedCount(0);
    }
  }


  const handleImagePick = (file: File) => {
    setSelectedCount(1);
    onImagePick(file);
    onClose();
  };

  const handleStickerPick = (opts: StickerPickPayload) => {
    setSelectedCount((c) => c + 1);
    if (onStickerPick) onStickerPick(opts);
    onClose();
  };

  const requestClose = () => {
    setConfigType(null);
    setShowGacha(false);
    setView('launcher');
    onClose();
  };

  if (!isOpen) return null;

  const returnToLauncher = () => {
    setConfigType(null);
    setShowGacha(false);
    setView('launcher');
  };
  const handleEscape = () => {
    if (configType) setConfigType(null);
    else if (showGacha) setShowGacha(false);
    else if ((initialTab === 'image' || initialTab === 'sticker') && view === initialTab) requestClose();
    else if (view !== 'launcher') returnToLauncher();
    else requestClose();
  };
  const childTitle: Record<Exclude<AttachmentSheetView, 'launcher'>, string> = { image: '圖片', sticker: '貼圖', interaction: '互動' };

  return (
    <ChatInteractionWindow ariaLabel="附件" onRequestClose={requestClose} onEscape={handleEscape}
      header={view === 'launcher' ? null : <InteractionWindowHeader>
          <div className="attachment-sheet-heading">
            <button type="button" className="attachment-back" onClick={returnToLauncher} aria-label="返回 Attachment Sheet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
            <div><h2 className="pr-attach-title">{childTitle[view]}</h2></div>
          </div>
        </InteractionWindowHeader>}
      footer={(view === 'interaction' && showGacha && gachaContexts && gachaContexts.length > 0) ? <InteractionWindowFooter>
            <span className="pr-attach-footer-count">已選擇 {gachaContexts.length} 項</span>
            <div className="pr-attach-footer-actions">
              <button type="button" className="pr-btn-cancel" onClick={onClose}>取消</button>
              <button type="button" className="pr-btn-confirm" onClick={onClose}>加入對話</button>
            </div>
          </InteractionWindowFooter> : undefined}>

        <InteractionWindowScrollBody>
          {view === 'launcher' && <div className="attachment-launcher-grid" role="group" aria-label="附件選項">
            {SEGMENTS.map((seg) => {
              return <button type="button" key={seg.key} className="attachment-launcher-action" onClick={() => setView(seg.key)}><AttachmentIcon type={seg.icon} /><span>{seg.label}</span></button>;
            })}
          </div>}

          {view === 'image' && <ImagePicker onPick={handleImagePick} />}

          {view === 'sticker' && onStickerPick && (
            <StickerLibrary onPick={handleStickerPick} onClose={onClose} />
          )}

          {view === 'interaction' && showGacha && (
            <>
              {replaceTarget && (
                <div className="gc-replace-banner" data-testid="gc-replace-banner" role="status">
                  重新選擇中：「{replaceTarget.title}」— 抽出後將直接替換
                </div>
              )}
              {(gachaContexts?.length || 0) > 0 && (
                <div className="gc-added-strip" data-testid="gc-added-strip">
                  <span className="gc-added-strip-label">已加入上下文（{gachaContexts!.length}）</span>
                  <div className="gc-added-strip-chips">
                    {gachaContexts!.map((gc, idx) => (
                      <span key={idx} className="gc-context-chip">
                        {gc.context.titleSnapshot}
                        {onRemoveGachaContext && (
                          <button
                            className="gc-context-chip-remove"
                            onClick={() => onRemoveGachaContext(idx)}
                            aria-label={`移除 ${gc.context.titleSnapshot}`}
                          >&#x2715;</button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" className="gacha-internal-header-back" onClick={() => setShowGacha(false)}>‹ 返回互動</button>
              <ChatGachaPanel onStickerPick={() => {}} onGachaResult={(payload) => { setSelectedCount((c) => c + 1); if (onGachaResult) onGachaResult(payload); }} onClose={onClose} />
            </>
          )}

          {view === 'interaction' && !showGacha && (
            <div className="interactive-slide" data-config-open={configType ? 'true' : 'false'}>
              {configType ? (() => {
                const Config = InteractiveToolRegistry[configType].configurationComponent;
                return <Config creatorIdentityId={currentCreatorIdentityId} onCancel={() => setConfigType(null)} onComplete={(attachment) => { onInteractivePick?.(attachment); setConfigType(null); onClose(); }} />;
              })() : <div className="pr-interactive-list" role="list">
                <button type="button" role="listitem" className="pr-interactive-item" onClick={() => setShowGacha(true)}><span className="pr-interactive-item-icon"><AttachmentIcon type="gacha" /></span><div className="pr-interactive-item-copy"><strong>扭蛋</strong><small>管理扭蛋池、抽取並帶入聊天</small></div><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg></button>
                {Object.values(InteractiveToolRegistry).map((tool) => (
                  <button type="button" role="listitem" className="pr-interactive-item" key={tool.type} onClick={() => setConfigType(tool.type)}>
                    <span className="pr-interactive-item-icon"><InteractiveIcon type={tool.type} /></span>
                    <div className="pr-interactive-item-copy"><strong>{tool.label}</strong><small>{tool.description}</small></div>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                ))}
              </div>}
            </div>
          )}

        </InteractionWindowScrollBody>
    </ChatInteractionWindow>
  );
}
