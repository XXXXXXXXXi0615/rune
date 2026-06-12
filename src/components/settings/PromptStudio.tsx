import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n';
import {
  loadPromptStudio,
  savePromptStudio,
  createDefaultPromptStudio,
  type PromptStudioData,
  type CharacterData,
  type RelationshipData,
} from '@/config/promptStudio';

interface Props { isOpen: boolean; onClose: () => void; }

type TabId = 'system' | 'world' | 'character' | 'relationship';

const TABS: { id: TabId; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'world', label: 'World' },
  { id: 'character', label: 'Character' },
  { id: 'relationship', label: 'Relationship' },
];

// ── Shared styles ──

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase',
  letterSpacing: '1px', fontWeight: 500, display: 'block', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border, #2a2a2a)',
  borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13,
  width: '100%', fontFamily: 'inherit', outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', minHeight: 80, lineHeight: 1.6,
};

// ── Character tab fields ──

const CHAR_FIELDS: { key: keyof CharacterData; label: string; rows: number }[] = [
  { key: 'name', label: '名稱', rows: 1 },
  { key: 'role', label: '身份', rows: 1 },
  { key: 'appearance', label: '外觀', rows: 2 },
  { key: 'personality', label: '性格', rows: 3 },
  { key: 'likes', label: '喜歡', rows: 2 },
  { key: 'dislikes', label: '討厭', rows: 2 },
];

// ── Relationship tab fields ──

const REL_FIELDS: { key: keyof RelationshipData; label: string; rows: number }[] = [
  { key: 'firstMeeting', label: '第一次見面', rows: 1 },
  { key: 'description', label: '關係描述', rows: 3 },
  { key: 'knownFacts', label: '已知事項', rows: 3 },
];

export function PromptStudio({ isOpen, onClose }: Props) {
  const [data, setData] = useState<PromptStudioData>(() => loadPromptStudio());
  const [tab, setTab] = useState<TabId>('system');
  const [dirty, setDirty] = useState(false);

  // Reload when opened
  useEffect(() => {
    if (isOpen) { setData(loadPromptStudio()); setDirty(false); }
  }, [isOpen]);

  const patch = (patch: Partial<PromptStudioData>) => {
    setData((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const patchCharacter = (p: Partial<CharacterData>) => {
    setData((d) => ({ ...d, character: { ...d.character, ...p } }));
    setDirty(true);
  };

  const patchRelationship = (p: Partial<RelationshipData>) => {
    setData((d) => ({ ...d, relationship: { ...d.relationship, ...p } }));
    setDirty(true);
  };

  const handleClose = () => {
    if (dirty && !confirm('有未儲存的修改，確定要離開嗎？')) return;
    onClose();
  };

  const handleSave = () => {
    savePromptStudio(data);
    setDirty(false);
    onClose();
  };

  const handleRestore = () => {
    const def = createDefaultPromptStudio();
    if (tab === 'system') setData((d) => ({ ...d, system: def.system }));
    if (tab === 'world') setData((d) => ({ ...d, world: def.world }));
    if (tab === 'character') setData((d) => ({ ...d, character: def.character }));
    if (tab === 'relationship') setData((d) => ({ ...d, relationship: def.relationship }));
    setDirty(true);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="prompt-studio-overlay" onClick={handleClose}>
      <div className="prompt-studio-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="quick-sheet-handle" style={{ marginTop: 12 }} />

        {/* Header */}
        <div style={{ padding: '6px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--f-d)', fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
            {t('ai.promptStudio')}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
            {t('ai.promptDesc')}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 3, gap: 2 }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', borderRadius: 8,
                  background: tab === t.id ? 'var(--bg)' : 'transparent',
                  color: tab === t.id ? 'var(--text)' : 'var(--text-3)',
                  fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'var(--f-ui)', transition: 'all 0.15s',
                  boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ── System ── */}
          {tab === 'system' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={labelStyle}>系統規則</label>
              <textarea style={textareaStyle} rows={8} value={data.system}
                onChange={(e) => patch({ system: e.target.value })}
                placeholder="描述系統層級規則、限制條件…" />
              <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
                這些規則會自動注入到每次對話的系統提示詞中。不要在此寫入角色性格（請用 Character 頁）。
              </div>
            </div>
          )}

          {/* ── World ── */}
          {tab === 'world' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={labelStyle}>世界觀</label>
              <textarea style={textareaStyle} rows={12} value={data.world}
                onChange={(e) => patch({ world: e.target.value })}
                placeholder="描述世界設定、地點、規則…" />
              <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
                定義 Lunartide 的世界。包括地點（月讀室、記憶庫）、概念（潮汐）、以及世界的法則。
              </div>
            </div>
          )}

          {/* ── Character ── */}
          {tab === 'character' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CHAR_FIELDS.map(({ key, label, rows }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  {rows > 1 ? (
                    <textarea style={textareaStyle} rows={rows}
                      value={data.character[key]}
                      onChange={(e) => patchCharacter({ [key]: e.target.value })} />
                  ) : (
                    <input style={inputStyle}
                      value={data.character[key]}
                      onChange={(e) => patchCharacter({ [key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Relationship ── */}
          {tab === 'relationship' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {REL_FIELDS.map(({ key, label, rows }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  {rows > 1 ? (
                    <textarea style={textareaStyle} rows={rows}
                      value={data.relationship[key]}
                      onChange={(e) => patchRelationship({ [key]: e.target.value })} />
                  ) : (
                    <input style={inputStyle}
                      value={data.relationship[key]}
                      onChange={(e) => patchRelationship({ [key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, padding: '12px 20px calc(16px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border)', background: 'var(--bg)',
        }}>
          <button type="button" className="btn-ghost" onClick={handleRestore} style={{ flex: 1 }}>
            {t('ai.restoreDefault')}
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} style={{ flex: 2 }}>
            {dirty ? '儲存變更' : t('sheet.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
