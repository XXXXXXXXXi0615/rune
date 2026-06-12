import { useState, useRef, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Header } from '@/components/layout/Header';
import { BackButton } from '@/components/layout/BackButton';
import { useModalStore } from '@/store/useModalStore';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { t } from '@/i18n';
import { resolveLunaPresence } from '@/utils/lunaPresence';
import { STORAGE_KEY } from '@/store/storage';
import { createLunartideBackup, restoreLunartideBackup, serializePersistedStore } from '@/utils/backup';
import { ProfileEditSheet } from '@/components/settings/ProfileEditSheet';
import { AiConnectionEntry } from '@/components/settings/AiConnectionPanel';
import { AiUsageDashboard } from '@/components/settings/AiUsageDashboard';
import { PromptStudio } from '@/components/settings/PromptStudio';
import { ToolsCenter } from '@/components/settings/ToolsCenter';
import { ProviderCenter } from '@/components/settings/ProviderCenter';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { EditIcon, CheckIcon } from '@/components/icons/LunartideIcons';
import type { ChatPresenceStatus } from '@/types';

function statusDotClass(status: ChatPresenceStatus): string {
  return `liquid-status-dot liquid-status-dot--${status}`;
}

function ChevronSvg() {
  return <svg className="liquid-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>;
}

export function SettingsPage() {
  const openModal = useModalStore((s) => s.openModal);
  const language = useAppStore((s) => s.language);
  const profile = useAppStore((s) => s.profile);
  const partner = useAppStore((s) => s.partner);
  const aiConfig = useAppStore((s) => s.aiConfig);
  const petWidget = useAppStore((s) => s.petWidget);
  const chatContacts = useAppStore((s) => s.chatContacts);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setLanguage = useAppStore((s) => s.setLanguage);

  const showToast = useToastStore((s) => s.showToast);
  const [sheetMode, setSheetMode] = useState<'profile' | 'partner' | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [providerCenterOpen, setProviderCenterOpen] = useState(false);
  const [aiUsageOpen, setAiUsageOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [toolsCenterOpen, setToolsCenterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lunaContact = chatContacts.find((c) => c.id === 'luna');
  const lunaStatus: ChatPresenceStatus = resolveLunaPresence(lunaContact, aiConfig);
  const lunaStatusLabel = t(`chat.presence.${lunaStatus}`);

  // ── Export ──
  const handleExport = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { showToast('尚無資料可匯出'); return; }
      const backup = createLunartideBackup(JSON.parse(raw));
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `lunartide_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      showToast('匯出完成');
      setExportOpen(false);
    } catch { showToast('匯出失敗'); }
  };

  // ── Import ──
  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = restoreLunartideBackup(JSON.parse(reader.result as string));
        localStorage.setItem(STORAGE_KEY, serializePersistedStore(data));
        showToast('匯入完成');
        setTimeout(() => window.location.reload(), 1500);
      } catch { showToast('匯入失敗'); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  // ── Clear ──
  const handleClearAll = async () => {
    const { deleteAssets } = await import('@/store/assets');
    const state = useAppStore.getState();
    const assetIds: string[] = [];
    for (const msg of state.messages) {
      if ((msg.type === 'image' || msg.type === 'file') && msg.assetId) assetIds.push(msg.assetId);
    }
    for (const track of state.music.tracks) {
      if (track.assetId) assetIds.push(track.assetId);
    }
    if (state.profile.avatarAssetId) assetIds.push(state.profile.avatarAssetId);
    if (state.profile.coverAssetId) assetIds.push(state.profile.coverAssetId);
    try { await deleteAssets(assetIds); } catch {}
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  return (
    <section id="settings-view" className="view">
      <BackButton to="/" />
      <Header eyebrow="" title={t('settings.title')} />

      {/* ── Profile ── */}
      <div className="liquid-card">
        <div className="liquid-section">
          <div className="liquid-row" onClick={() => setSheetMode('profile')} style={{ cursor: 'pointer' }}>
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="liquid-row-text">
                <div className="liquid-row-label">{profile.displayName}</div>
                <div className="liquid-row-hint">{profile.status === '月潮同步中' ? t('settings.localSaved') : (profile.status || t('settings.localSaved'))}</div>
              </div>
            </div>
            <div className="liquid-row-right"><ChevronSvg /></div>
          </div>
        </div>
      </div>

      {/* ── Luna ── */}
      <div className="liquid-card">
        <div className="liquid-section">
          <div className="liquid-row" onClick={() => setSheetMode('partner')} style={{ cursor: 'pointer' }}>
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              </div>
              <div className="liquid-row-text">
                <div className="liquid-row-label">{partner.name || 'LUNARIS'}</div>
                <div className="liquid-status-row">
                  <span className={statusDotClass(lunaStatus)} /><span>{lunaStatusLabel}</span>
                </div>
              </div>
            </div>
            <div className="liquid-row-right"><ChevronSvg /></div>
          </div>
        </div>
      </div>

      {/* ── Preferences ── */}
      <div className="liquid-card">
        <div className="liquid-section">
          {/* Language */}
          <div className="liquid-row" onClick={() => setLangOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div className="liquid-row-text"><div className="liquid-row-label">{t('settings.language')}</div></div>
            </div>
            <div className="liquid-row-right">
              <span className="liquid-lang-chip">{language === 'en' ? 'English' : '繁體中文'}</span>
              <ChevronSvg />
            </div>
          </div>

          {/* Clawd toggle */}
          <div className="liquid-row">
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <circle cx="12" cy="10" r="6" /><path d="M6 20v-1a6 6 0 0 1 6-6 6 6 0 0 1 6 6v1" />
                </svg>
              </div>
              <div className="liquid-row-text"><div className="liquid-row-label">{t('pet.showToggle')}</div></div>
            </div>
            <div className="liquid-row-right">
              <label className="liquid-switch">
                <input type="checkbox" checked={petWidget?.visible !== false} aria-label={t('pet.showHideAria')}
                  onChange={(e) => updateSettings({ petWidget: { ...petWidget, visible: e.target.checked, currentMood: petWidget?.currentMood || 'idle', moodImages: petWidget?.moodImages || {} } })} />
                <span className="liquid-switch-track" /><span className="liquid-switch-knob" />
              </label>
            </div>
          </div>

        </div>
      </div>

      {/* ── AI ── */}
      <div className="liquid-card">
        <div className="liquid-section">
          <AiConnectionEntry onOpen={() => setProviderCenterOpen(true)} />
          <div className="liquid-row" onClick={() => setAiUsageOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
                </svg>
              </div>
              <div className="liquid-row-text">
                <div className="liquid-row-label">{t('ai.usageTitle')}</div>
                <div className="liquid-row-hint">{t('ai.usageHint')}</div>
              </div>
            </div>
            <div className="liquid-row-right"><ChevronSvg /></div>
          </div>
          <div className="liquid-row" onClick={() => setPromptOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M12 2a4 4 0 0 1 4 4v1h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z" /><circle cx="12" cy="13" r="2" />
                </svg>
              </div>
              <div className="liquid-row-text">
                <div className="liquid-row-label">{t('ai.promptStudio')}</div>
                <div className="liquid-row-hint">{t('ai.promptDesc')}</div>
              </div>
            </div>
            <div className="liquid-row-right"><ChevronSvg /></div>
          </div>

          {/* Tools Center */}
          <div className="liquid-row" onClick={() => setToolsCenterOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule" style={{ background: 'rgba(212,160,80,0.12)', color: 'var(--amber)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <div className="liquid-row-text">
                <div className="liquid-row-label">工具中心</div>
                <div className="liquid-row-hint">管理 Luna 可調用的工具與 MCP 設定</div>
              </div>
            </div>
            <div className="liquid-row-right"><ChevronSvg /></div>
          </div>
        </div>
      </div>

      {/* ── Data ── */}
      <div className="liquid-card">
        <div className="liquid-section">
          {/* Export */}
          <div className="liquid-row" onClick={() => setExportOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule" style={{ color: 'var(--success)', background: 'rgba(93,184,114,0.12)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div className="liquid-row-text">
                <div className="liquid-row-label">{t('settings.exportLabel')}</div>
                <div className="liquid-row-hint">{t('settings.exportHint')}</div>
              </div>
            </div>
            <div className="liquid-row-right"><ChevronSvg /></div>
          </div>

          {/* Import */}
          <div className="liquid-row" onClick={() => setImportOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule" style={{ color: 'var(--teal)', background: 'rgba(93,184,166,0.12)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="liquid-row-text">
                <div className="liquid-row-label">{t('settings.importLabel')}</div>
                <div className="liquid-row-hint">{t('settings.importHint')}</div>
              </div>
            </div>
            <div className="liquid-row-right"><ChevronSvg /></div>
          </div>

          {/* Clear */}
          <div className="liquid-row" onClick={() => setClearOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="liquid-row-left">
              <div className="liquid-icon-capsule" style={{ color: 'var(--danger)', background: 'rgba(198,69,69,0.08)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <div className="liquid-row-text">
                <div className="liquid-row-label">{t('settings.clearLabel')}</div>
                <div className="liquid-row-hint">{t('settings.clearHint')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* MODALS & SHEETS */}
      {/* ══════════════════════════════════════════════ */}

      {/* Hidden file input */}
      {createPortal(<input ref={fileInputRef} type="file" accept="application/json" hidden aria-hidden="true" tabIndex={-1}
        style={{ display: 'none' }} onChange={handleImportFile} />, document.body)}

      {/* Language */}
      {langOpen && createPortal(
        <div className="lang-modal-overlay" onClick={() => setLangOpen(false)}>
          <div className="lang-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="lang-modal-title">{t('settings.chooseLanguage')}</h2>
            <div className="lang-modal-options">
              {(['zh-TW', 'en'] as const).map((lg) => (
                <button key={lg} type="button" className={`lang-modal-option ${lg === language ? 'active' : ''}`}
                  onClick={() => { setLanguage(lg); setLangOpen(false); }}>
                  <span className="lang-modal-option-label">{lg === 'zh-TW' ? t('settings.zhTW') : t('settings.en')}</span>
                  {lg === language && <CheckIcon size={18} />}
                </button>
              ))}
            </div>
            <button type="button" className="liquid-btn lang-modal-cancel" onClick={() => setLangOpen(false)}>{t('sheet.cancel')}</button>
          </div>
        </div>, document.body)}

      {/* Export Modal */}
      <SettingsModal isOpen={exportOpen} onClose={() => setExportOpen(false)} title={t('settings.exportLabel')} subtitle={t('settings.exportHint')}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, padding: '4px 0' }}>
          對話 · 記憶 · 待辦 · 塔羅 · 設定
        </div>
        <button type="button" className="liquid-btn liquid-btn--accent" onClick={handleExport} style={{ width: '100%', justifyContent: 'center' }}>
          匯出 JSON
        </button>
      </SettingsModal>

      {/* Import Modal */}
      <SettingsModal isOpen={importOpen} onClose={() => setImportOpen(false)} title={t('settings.importLabel')} subtitle={t('settings.importHint')}>
        <div style={{ fontSize: 12, color: 'var(--amber)', padding: '8px 0', lineHeight: 1.5, textAlign: 'center' }}>
          匯入將覆蓋目前所有資料。建議先匯出備份。
        </div>
        <button type="button" className="liquid-btn liquid-btn--accent" onClick={() => fileInputRef.current?.click()} style={{ width: '100%', justifyContent: 'center' }}>
          上傳 JSON 匯入
        </button>
      </SettingsModal>

      {/* Clear Modal */}
      <SettingsModal isOpen={clearOpen} onClose={() => setClearOpen(false)} title={t('settings.clearLabel')}>
        <div style={{ fontSize: 13, color: 'var(--danger)', lineHeight: 1.6, textAlign: 'center', padding: '8px 0' }}>
          {t('danger.warn')}
        </div>
        <button type="button" className="liquid-btn liquid-btn--danger" onClick={handleClearAll} style={{ width: '100%', justifyContent: 'center' }}>
          確認清除所有資料
        </button>
      </SettingsModal>

      {/* Profile Edit Sheets */}
      {sheetMode === 'profile' && <ProfileEditSheet isOpen onClose={() => setSheetMode(null)} mode="profile" />}
      {sheetMode === 'partner' && <ProfileEditSheet isOpen onClose={() => setSheetMode(null)} mode="partner" />}

      {/* Pet Appearance Sheet */}

      {/* AI Panels — only mount when open (double guard) */}
      {providerCenterOpen && <ProviderCenter isOpen onClose={() => setProviderCenterOpen(false)} />}
      {aiUsageOpen && <AiUsageDashboard isOpen onClose={() => setAiUsageOpen(false)} />}
      {promptOpen && <PromptStudio isOpen onClose={() => setPromptOpen(false)} />}

      {/* Tools Center */}
      <ToolsCenter isOpen={toolsCenterOpen} onClose={() => setToolsCenterOpen(false)} />
    </section>
  );
}
