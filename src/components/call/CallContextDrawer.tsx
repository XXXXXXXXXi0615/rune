import { useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useCallStore } from '@/store/useCallStore';
import { saveAsset } from '@/store/assets';
import type { SharedCallContextType } from '@/types';

interface CallContextDrawerProps {
  onClose: () => void;
}

/**
 * Simulated content sharing. Only app content may be shared:
 * images, documents, journal entries, context cards.
 * This never captures the real screen.
 */
export function CallContextDrawer({ onClose }: CallContextDrawerProps) {
  const shareContext = useCallStore((s) => s.shareContext);
  const sharedContexts = useCallStore((s) => s.session?.sharedContexts || []);
  const journalEntries = useAppStore((s) => s.journalWorkspaceEntries || []);
  const memoryEntries = useAppStore((s) => s.memoryEntries || []);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File | undefined, type: SharedCallContextType) => {
    if (!file) return;
    try {
      const assetId = await saveAsset(file, file.type || 'application/octet-stream');
      shareContext({ type, title: file.name, assetId });
    } catch { /* toast handled globally */ }
  };

  const journals = journalEntries.filter((entry) => !entry.archived).slice(0, 8);
  const memories = memoryEntries.slice(0, 8);

  return (
    <div className="call-context-drawer" role="dialog" aria-label="分享內容" data-testid="call-context-drawer">
      <header>
        <h3>分享內容</h3>
        <button type="button" onClick={onClose} aria-label="關閉分享面板">
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <p className="call-context-drawer__note">模擬分享：只會分享應用內的內容，不會擷取你的真實螢幕。</p>

      <div className="call-context-drawer__actions">
        <button type="button" onClick={() => imageInputRef.current?.click()}>
          <span>圖片</span>
          <small>從裝置選擇圖片</small>
        </button>
        <button type="button" onClick={() => documentInputRef.current?.click()}>
          <span>文件</span>
          <small>分享一份檔案</small>
        </button>
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="選擇要分享的圖片"
        onChange={(event) => { void handleUpload(event.target.files?.[0], 'image'); event.target.value = ''; }}
      />
      <input
        ref={documentInputRef}
        type="file"
        hidden
        aria-label="選擇要分享的文件"
        onChange={(event) => { void handleUpload(event.target.files?.[0], 'document'); event.target.value = ''; }}
      />

      <section>
        <h4>手記</h4>
        {journals.length === 0 && <p className="call-context-drawer__empty">還沒有手記。</p>}
        <ul>
          {journals.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => shareContext({ type: 'journal', title: entry.title || entry.content.slice(0, 20) || '手記', refId: entry.id })}
              >
                {entry.title || entry.content.slice(0, 24) || '（無標題手記）'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4>上下文卡</h4>
        {memories.length === 0 && <p className="call-context-drawer__empty">還沒有記憶卡片。</p>}
        <ul>
          {memories.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => shareContext({ type: 'context-card', title: entry.title || entry.scene || '記憶', refId: entry.id })}
              >
                {entry.title || entry.scene || entry.summary || '（記憶卡）'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {sharedContexts.length > 0 && (
        <section>
          <h4>已分享（{sharedContexts.length}）</h4>
          <ul className="call-context-drawer__shared" data-testid="call-shared-list">
            {sharedContexts.map((context) => (
              <li key={context.id}>
                <span className="call-context-drawer__type">{context.type === 'image' ? '圖片' : context.type === 'document' ? '文件' : context.type === 'journal' ? '手記' : '上下文卡'}</span>
                {context.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
