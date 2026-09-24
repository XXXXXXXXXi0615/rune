import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import { DEFAULT_CHAT_BACKGROUND_CONFIG, normalizeChatBackgroundConfig, selectEffectiveChatBackground, type ChatBackgroundConfig } from '@/config/chatBackground';
import { useChatBackgroundStore } from '@/store/useChatBackgroundStore';
import { savePortableAsset } from '@/store/assets';
import { useResolvedAssetUrl } from '@/hooks/useAssetBlobUrl';

interface Props { open: boolean; onClose: () => void; conversationId?: string | null; }
type Scope = 'conversation' | 'global';

const emptyDraft = () => ({ ...DEFAULT_CHAT_BACKGROUND_CONFIG });

export function ChatBackgroundModal({ open, onClose, conversationId }: Props) {
  const settings = useChatBackgroundStore((state) => state.settings);
  const saveGlobal = useChatBackgroundStore((state) => state.saveGlobal);
  const saveConversation = useChatBackgroundStore((state) => state.saveConversation);
  const clearGlobal = useChatBackgroundStore((state) => state.clearGlobal);
  const clearConversation = useChatBackgroundStore((state) => state.clearConversation);
  const fileRef = useRef<HTMLInputElement>(null);
  const initialRef = useRef('');
  const savingRef = useRef(false);
  const [scope, setScope] = useState<Scope>(conversationId ? 'conversation' : 'global');
  const [draft, setDraft] = useState<ChatBackgroundConfig>(emptyDraft);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const previewUrl = useResolvedAssetUrl(draft.source === 'custom' ? draft.assetId : undefined);
  const hasImage = draft.source === 'custom' && Boolean(draft.assetId);
  const dirty = JSON.stringify(draft) !== initialRef.current;

  const configFor = useCallback((nextScope: Scope) => {
    if (nextScope === 'global') return normalizeChatBackgroundConfig(settings.global);
    if (!conversationId) return emptyDraft();
    return normalizeChatBackgroundConfig(settings.conversationOverrides[conversationId]
      ?? selectEffectiveChatBackground({ conversationId, settings }));
  }, [conversationId, settings]);

  useEffect(() => {
    if (!open) return;
    const nextScope: Scope = conversationId ? 'conversation' : 'global';
    const next = configFor(nextScope);
    setScope(nextScope); setDraft(next); setSaved(false); initialRef.current = JSON.stringify(next);
  }, [open, conversationId]);

  const requestClose = () => {
    if (dirty && !window.confirm('尚未儲存背景變更，確定要關閉？')) return;
    onClose();
  };

  const switchScope = (nextScope: Scope) => {
    if (nextScope === scope || (nextScope === 'conversation' && !conversationId)) return;
    if (dirty && !window.confirm('切換範圍會捨棄尚未儲存的變更，是否繼續？')) return;
    const next = configFor(nextScope);
    setScope(nextScope); setDraft(next); setSaved(false); initialRef.current = JSON.stringify(next);
  };

  const handleFile = useCallback(async (file: File) => {
    if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) return;
    setUploading(true); setSaved(false);
    try {
      const assetId = await savePortableAsset(file, file.type);
      setDraft((current) => ({ ...current, source: 'custom', assetId, updatedAt: Date.now() }));
    } finally { setUploading(false); }
  }, []);

  const save = async () => {
    if (!hasImage || savingRef.current || (scope === 'conversation' && !conversationId)) return;
    savingRef.current = true;
    const config = { ...draft, updatedAt: Date.now() };
    if (scope === 'global') saveGlobal(config); else saveConversation(conversationId!, config);
    setDraft(config); initialRef.current = JSON.stringify(config); setSaved(true);
    savingRef.current = false;
  };

  const clear = () => {
    if (scope === 'global') clearGlobal(); else if (conversationId) clearConversation(conversationId);
    const next = scope === 'conversation' && conversationId
      ? selectEffectiveChatBackground({ conversationId, settings: useChatBackgroundStore.getState().settings })
      : emptyDraft();
    setDraft(next); initialRef.current = JSON.stringify(next); setSaved(true);
  };

  const updateNumber = (key: 'overlayOpacity' | 'blurPx' | 'positionX' | 'positionY', value: number) => {
    setSaved(false); setDraft((current) => ({ ...current, [key]: value }));
  };

  const previewStyle = useMemo(() => ({
    objectPosition: `${draft.positionX}% ${draft.positionY}%`,
    filter: draft.blurPx ? `blur(${draft.blurPx}px)` : undefined,
  }), [draft.blurPx, draft.positionX, draft.positionY]);

  if (!open) return null;
  return <MobileShellOverlay onClose={requestClose} variant="fullscreen">
    <section className="quick-sheet cbg-modal" role="dialog" aria-modal="true" aria-label="聊天背景" onClick={(event) => event.stopPropagation()}>
      <header className="cbg-modal__header"><div className="quick-sheet-handle"/><strong>聊天背景</strong><button type="button" onClick={requestClose} aria-label="關閉聊天背景">×</button></header>
      <div className="cbg-modal__body">
        <section className="cbg-section"><div className="cbg-section-title"><strong>套用範圍</strong><small>各範圍分開保存，不會互相覆蓋</small></div><div className="cbg-scope" role="group" aria-label="套用範圍">
          <button type="button" className={scope === 'conversation' ? 'is-active' : ''} disabled={!conversationId} aria-pressed={scope === 'conversation'} onClick={() => switchScope('conversation')}>目前對話</button>
          <button type="button" className={scope === 'global' ? 'is-active' : ''} aria-pressed={scope === 'global'} onClick={() => switchScope('global')}>所有聊天</button>
        </div></section>

        {hasImage && previewUrl ? <section className="cbg-chat-preview" aria-label="聊天背景即時預覽">
          <img src={previewUrl} alt="" style={previewStyle}/><span className="cbg-chat-preview__overlay" style={{ backgroundColor: `rgba(255,248,244,${draft.overlayOpacity})` }}/>
          <div className="cbg-chat-preview__content"><header>LUNARIS <small>今天</small></header><span className="is-date">今天 21:08</span><p className="is-received">今晚想從哪裡開始？</p><p className="is-sent">先把這裡整理好。</p></div>
        </section> : <button type="button" className="cbg-dropzone" onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void handleFile(file); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/></svg><strong>{uploading ? '上傳中…' : '上傳背景圖片'}</strong><small>JPEG／PNG／WebP · 點擊或拖放</small>
        </button>}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }}/>

        {hasImage && <div className="cbg-image-actions"><button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? '上傳中…' : '更換圖片'}</button><span>PNG／WebP Alpha 會保留</span></div>}

        <label className="cbg-control"><span className="cbg-control-header"><span><strong>內容遮罩</strong><small>越高，聊天文字越容易閱讀</small></span><output>{Math.round(draft.overlayOpacity * 100)}%</output></span><input className="cbg-range" type="range" min="0" max="0.9" step="0.05" value={draft.overlayOpacity} disabled={!hasImage} onChange={(event) => updateNumber('overlayOpacity', Number(event.target.value))}/></label>
        <label className="cbg-control"><span className="cbg-control-header"><span><strong>背景模糊</strong><small>只模糊背景圖片</small></span><output>{draft.blurPx}px</output></span><input className="cbg-range" type="range" min="0" max="24" step="1" value={draft.blurPx} disabled={!hasImage} onChange={(event) => updateNumber('blurPx', Number(event.target.value))}/></label>
        {hasImage && <details className="cbg-position"><summary>調整位置</summary><label>水平 <output>{draft.positionX}%</output><input className="cbg-range" type="range" min="0" max="100" step="1" value={draft.positionX} onChange={(event) => updateNumber('positionX', Number(event.target.value))}/></label><label>垂直 <output>{draft.positionY}%</output><input className="cbg-range" type="range" min="0" max="100" step="1" value={draft.positionY} onChange={(event) => updateNumber('positionY', Number(event.target.value))}/></label></details>}
      </div>
      <footer className="cbg-modal__footer"><button type="button" className="cbg-clear" disabled={!hasImage && !(scope === 'conversation' && conversationId && settings.conversationOverrides[conversationId])} onClick={clear}>清除背景</button><span role="status">{saved ? '已儲存' : ''}</span><button type="button" className="cbg-save" disabled={!hasImage || uploading} onClick={() => void save()}>儲存背景</button></footer>
    </section>
  </MobileShellOverlay>;
}
