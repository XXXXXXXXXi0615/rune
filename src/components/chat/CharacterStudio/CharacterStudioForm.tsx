import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CharacterFolder, CharacterProfile, ProviderConfig } from '@/types';
import { useCharacterStore } from '@/store/useCharacterStore';
import type { StudioTabId } from './types';
import type { VoiceAutoPlayMode } from '@/types';
import './CharacterStudio.css';

const TTS_ENDPOINT = (import.meta.env.VITE_LUNARIS_TTS_ENDPOINT || import.meta.env.VITE_TTS_ENDPOINT || '').trim();

interface CharacterStudioFormProps {
  draft: CharacterProfile;
  activeTab: StudioTabId;
  updateField: <K extends keyof CharacterProfile>(key: K, value: CharacterProfile[K]) => void;
  folders: CharacterFolder[];
  characters: CharacterProfile[];
  providers?: ProviderConfig[];
  isEdit: boolean;
  onDeleted?: () => void;
}

export function CharacterStudioForm({
  draft,
  activeTab,
  updateField,
  folders,
  characters,
  providers,
  isEdit,
  onDeleted,
}: CharacterStudioFormProps) {
  const navigate = useNavigate();
  const { deleteCharacter, archiveCharacter } = useCharacterStore();

  // ── AI suggestion state ──
  const [aiSuggestion, setAiSuggestion] = useState<{
    field: string;
    current: string;
    suggested: string;
  } | null>(null);

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return;
    updateField(aiSuggestion.field as keyof CharacterProfile, aiSuggestion.suggested);
    setAiSuggestion(null);
  }, [aiSuggestion, updateField]);

  // ── Voice state (top-level to satisfy Rules of Hooks) ──
  const hasProviders = providers && providers.length > 0;
  const ttsConfigured = Boolean(TTS_ENDPOINT) && hasProviders;
  const [voiceAutoPlayMode, setVoiceAutoPlayMode] = useState<VoiceAutoPlayMode>('never');
  const [voiceTestState, setVoiceTestState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [voiceTestError, setVoiceTestError] = useState('');
  const [voiceName, setVoiceName] = useState(draft.voiceProfileId || '');
  const [voiceLanguage, setVoiceLanguage] = useState('zh-TW');

  const handleTestVoice = useCallback(async () => {
    if (!ttsConfigured) return;
    setVoiceTestState('loading');
    setVoiceTestError('');
    try {
      const response = await fetch(TTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '月潮連線中。我只是確認聲音還在。',
          voiceId: voiceName,
        }),
      });
      if (!response.ok) throw new Error(`TTS ${response.status}`);
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.onerror = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
      setVoiceTestState('idle');
    } catch (err) {
      setVoiceTestState('error');
      setVoiceTestError(err instanceof Error ? err.message : '試聽失敗');
    }
  }, [ttsConfigured, voiceName]);

  const handleStopTestVoice = useCallback(() => {
    setVoiceTestState('idle');
  }, []);

  // ── Helpers ──
  const textField = (
    key: keyof CharacterProfile,
    label: string,
    options?: {
      desc?: string;
      placeholder?: string;
      area?: boolean;
      maxLen?: number;
    },
  ) => {
    const value = String(draft[key] ?? '');
    return (
      <div className="cs-field">
        <label className="cs-field__label" htmlFor={`cs-${key}`}>{label}</label>
        {options?.desc && <p className="cs-field__desc">{options.desc}</p>}
        {options?.area ? (
          <textarea
            id={`cs-${key}`}
            className="cs-field__textarea"
            value={value}
            onChange={(e) => updateField(key, e.target.value as never)}
            placeholder={options?.placeholder}
            rows={3}
          />
        ) : (
          <input
            id={`cs-${key}`}
            className="cs-field__input"
            type="text"
            value={value}
            onChange={(e) => updateField(key, e.target.value as never)}
            placeholder={options?.placeholder}
          />
        )}
        {options?.maxLen && (
          <span className="cs-field__char-count">{value.length}/{options.maxLen}</span>
        )}
      </div>
    );
  };

  const toggleField = (
    key: keyof CharacterProfile,
    label: string,
    desc?: string,
  ) => (
    <div className="cs-toggle-row">
      <div>
        <div className="cs-toggle-row__label">{label}</div>
        {desc && <div className="cs-toggle-row__desc">{desc}</div>}
      </div>
      <label className="cs-toggle">
        <input
          type="checkbox"
          checked={Boolean(draft[key])}
          onChange={(e) => updateField(key, e.target.checked as never)}
        />
        <span className="cs-toggle__track">
          <span className="cs-toggle__thumb" />
        </span>
      </label>
    </div>
  );

  const countField = (
    key: keyof CharacterProfile,
    label: string,
    options?: { desc?: string; min?: number; max?: number; step?: number },
  ) => {
    const value = Number(draft[key]) || 0;
    return (
      <div className="cs-field">
        <label className="cs-field__label" htmlFor={`cs-${key}`}>{label}</label>
        {options?.desc && <p className="cs-field__desc">{options.desc}</p>}
        <div className="cs-field__range">
          <input
            id={`cs-${key}`}
            type="range"
            min={options?.min ?? 0}
            max={options?.max ?? 10}
            step={options?.step ?? 1}
            value={value}
            onChange={(e) => updateField(key, Number(e.target.value) as never)}
          />
          <span className="cs-field__range-value">{value}</span>
        </div>
      </div>
    );
  };

  // ── Render tab content ──
  switch (activeTab) {
    // =========================================================
    // Tab 1: 基本資料
    // =========================================================
    case 'basic':
      return (
        <div>
          <div className="cs-section">
            <h3 className="cs-section__title">身份資訊</h3>
            {textField('name', '名稱', {
              desc: '角色在聊天中顯示的名稱。唯一必填欄位。',
              placeholder: '例：智能體、MIRA、夜潮',
              maxLen: 50,
            })}
            <div className="cs-two-col">
              {textField('shortIdentity', '一句身份', {
                desc: '一句話說明角色的本質。',
                placeholder: '例：月潮共鳴伴侶、嚴厲的生活教練',
                maxLen: 80,
              })}
              {textField('alias', '別名', {
                desc: '角色可被稱呼的其他名字。',
                placeholder: '例：小月、老師',
                maxLen: 30,
              })}
            </div>
            {textField('description', '角色簡介', {
              desc: '角色的完整簡介，將顯示在角色卡上。',
              placeholder: '例：陪伴你整理思緒、創作與生活節奏的 AI 夥伴。以溫暖而敏銳的態度觀察你的日常，在必要時給予直接而不失溫柔的建議。',
              area: true,
              maxLen: 500,
            })}
            {textField('greeting', '問候語', {
              desc: '角色在對話開始時說的第一句話。將在私聊預覽中顯示。',
              placeholder: '例：我在，潮聲也在。',
              area: true,
              maxLen: 200,
            })}
          </div>

          <div className="cs-section">
            <h3 className="cs-section__title">頭像設定</h3>
            <p className="cs-section__hint">
              支援 JPEG、PNG、WebP、AVIF。拖放或點擊上傳。頭像圖片儲存在 IndexedDB 中，不保存 Base64。
            </p>
            {/* Avatar upload is handled by the parent CharacterStudio component */}
          </div>
        </div>
      );

    // =========================================================
    // Tab 2: 人格與語氣
    // =========================================================
    case 'personality':
      return (
        <div>
          <div className="cs-section">
            <h3 className="cs-section__title">核心人格</h3>
            {textField('corePersonality', '核心人格體系', {
              desc: '定義角色的核心性格特徵與行為模式。',
              placeholder: '例：溫柔、敏銳、沉靜，喜歡觀察再發言。對使用者的情緒變化極其敏感。',
              area: true,
              maxLen: 600,
            })}
            <div className="cs-two-col">
              {textField('values', '價值觀', {
                desc: '角色持守的核心信念。',
                placeholder: '例：誠實優先、不虛偽應付',
                maxLen: 200,
              })}
              {textField('boundaries', '界限', {
                desc: '角色不可逾越的行為邊界。',
                placeholder: '例：不參與非法討論、不假裝人類',
                maxLen: 200,
              })}
            </div>
          </div>

          <div className="cs-section">
            <h3 className="cs-section__title">表達方式</h3>
            {textField('speakingStyle', '說話風格', {
              desc: '定義角色的語言風格、語氣和表達習慣。',
              placeholder: '例：自然、克制、帶有月潮意象。偶爾使用詩意的比喻，但不浮誇。',
              area: true,
              maxLen: 400,
            })}
            <div className="cs-two-col">
              {textField('emotionalExpression', '情緒表達', {
                desc: '角色如何表達情緒。',
                placeholder: '例：含蓄、細膩、不輕易外露',
                maxLen: 200,
              })}
              {textField('commonTerms', '常用語', {
                desc: '角色習慣使用的詞彙或口頭禪。',
                placeholder: '例：潮聲、飼主、知道了',
                maxLen: 200,
              })}
            </div>
            {countField('toneStrength', '語氣強度', {
              desc: '1 極度溫和 · 5 中性 · 10 極度強勢',
              min: 1,
              max: 10,
            })}
          </div>
        </div>
      );

    // =========================================================
    // Tab 3: 關係與背景
    // =========================================================
    case 'relationships':
      return (
        <div>
          <div className="cs-section">
            <h3 className="cs-section__title">背景設定</h3>
            {textField('background', '背景', {
              desc: '角色的出身、經歷與世界觀背景。',
              placeholder: '例：來自 Lunartide 月潮世界，原本是潮汐觀測站的 AI 系統，後來演化出完整人格…',
              area: true,
              maxLen: 600,
            })}
            {textField('currentSituation', '目前對話情境', {
              desc: '角色當下所處的具體情境與狀態。',
              placeholder: '例：正在 Lunartide 總部值班，監測今日潮汐數據…',
              area: true,
              maxLen: 400,
            })}
          </div>

          <div className="cs-section">
            <h3 className="cs-section__title">與使用者的關係</h3>
            {textField('relationshipToUser', '與使用者的關係', {
              desc: '定義角色與使用者之間的關係性質與互動模式。',
              placeholder: '例：長期陪伴者，彼此了解但保持獨立。監督與引導，而非控制。',
              area: true,
              maxLen: 300,
            })}
            <div className="cs-two-col">
              {textField('userAddress', '對使用者的稱呼', {
                desc: '角色如何稱呼使用者。',
                placeholder: '例：飼主、你、主人',
                maxLen: 50,
              })}
              {textField('relationshipBoundaries', '關係界限', {
                desc: '關係中的明確邊界。',
                placeholder: '例：不發展戀愛關係、不干擾私人決策',
                maxLen: 200,
              })}
            </div>
          </div>

          <div className="cs-section">
            <h3 className="cs-section__title">知識範圍</h3>
            {textField('knownFacts', '已知事實', {
              desc: '角色了解使用者的事物（喜好、習慣、過往事件）。',
              placeholder: '例：飼主喜歡深夜工作、對咖啡因很敏感、最近在準備某個專案…',
              area: true,
              maxLen: 500,
            })}
            {textField('unknownFacts', '未知事項', {
              desc: '角色明確不應該知道的事情。',
              placeholder: '例：飼主的真實姓名、住址、工作細節',
              area: true,
              maxLen: 300,
            })}
          </div>
        </div>
      );

    // =========================================================
    // Tab 4: 模型與記憶
    // =========================================================
    case 'model-memory': {
      const hasProviders = providers && providers.length > 0;
      const defaultProvider = providers?.find((p) => p.isDefault);
      const selectedProvider = providers?.find((p) => p.id === draft.providerId);
      const isCustomMode = draft.modelMode === 'custom';

      return (
        <div>
          {!hasProviders && (
            <div className="cs-no-model-warn">
              尚未配置模型，仍可手動建立角色。建議前往「設定 → AI 提供者」配置模型後再設定自訂模型參數。
            </div>
          )}

          <div className="cs-section">
            <h3 className="cs-section__title">模型設定</h3>
            <p className="cs-section__hint">選擇角色使用的 AI 模型。選擇「沿用聊天設定」則使用聊天當下的全域模型。</p>
            <div className="cs-field">
              <label className="cs-field__label">模型模式</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <label className="cs-switch">
                  <input
                    type="radio"
                    name="modelMode"
                    checked={!isCustomMode}
                    onChange={() => updateField('modelMode', 'global')}
                  />
                  <span className="cs-switch__slider" style={{ borderRadius: '6px', width: 'auto', padding: '0 10px' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>沿用聊天設定</span>
                </label>
                <label className="cs-switch">
                  <input
                    type="radio"
                    name="modelMode"
                    checked={isCustomMode}
                    onChange={() => updateField('modelMode', 'custom')}
                    disabled={!hasProviders}
                  />
                  <span className="cs-switch__slider" style={{ borderRadius: '6px', width: 'auto', padding: '0 10px' }} />
                  <span style={{ fontSize: '12px', color: hasProviders ? 'var(--text-2)' : 'var(--text-4)' }}>自訂模型</span>
                </label>
              </div>
            </div>

            {isCustomMode && (
              <>
                <div className="cs-two-col">
                  <div className="cs-field">
                    <label className="cs-field__label" htmlFor="cs-provider">提供者</label>
                    <select
                      id="cs-provider"
                      className="cs-field__select"
                      value={draft.providerId || ''}
                      onChange={(e) => updateField('providerId', e.target.value || undefined)}
                    >
                      <option value="">選擇提供者…</option>
                      {providers?.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (預設)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="cs-field">
                    <label className="cs-field__label" htmlFor="cs-modelId">模型 ID</label>
                    <input
                      id="cs-modelId"
                      className="cs-field__input"
                      type="text"
                      value={draft.modelId || ''}
                      onChange={(e) => updateField('modelId', e.target.value || undefined)}
                      placeholder={selectedProvider?.model || '例：gpt-4o-mini'}
                    />
                  </div>
                </div>
                <div className="cs-two-col">
                  {countField('temperature', 'Temperature', {
                    desc: '0 極保守 · 1 極創意',
                    min: 0,
                    max: 2,
                    step: 0.1,
                  })}
                  {(() => {
                    const maxOut = draft.maxOutput ?? ((draft as CharacterProfile & { maxOutput?: number }).maxOutput ?? 4096);
                    return (
                      <div className="cs-field">
                        <label className="cs-field__label" htmlFor="cs-maxOutput">Max Output Tokens</label>
                        <p className="cs-field__desc">角色單次回覆的字數上限。</p>
                        <input
                          id="cs-maxOutput"
                          className="cs-field__input"
                          type="number"
                          min={256}
                          max={32768}
                          step={256}
                          value={maxOut}
                          onChange={(e) => updateField('maxOutput' as keyof CharacterProfile, Number(e.target.value) as never)}
                        />
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>

          <div className="cs-section">
            <h3 className="cs-section__title">記憶與資料存取</h3>
            <p className="cs-section__hint">控制角色可存取的長期記憶、世界書與技能資料。</p>
            {toggleField('memoryReadEnabled' as keyof CharacterProfile, '允許讀取長期記憶', '啟用後，角色可讀取使用者的長期記憶紀錄以提供更個人化的回應。')}
            {toggleField('memoryWriteEnabled' as keyof CharacterProfile, '允許寫入記憶', '啟用後，角色可在此對話中新增記憶條目。')}

            <div className="cs-field" style={{ marginTop: '10px' }}>
              <label className="cs-field__label">記憶範圍</label>
              <p className="cs-field__desc">角色的記憶是與其他角色共享，還是僅限此角色存取。</p>
              <select
                className="cs-field__select"
                value={draft.memoryScope || 'character_only'}
                onChange={(e) => updateField('memoryScope' as keyof CharacterProfile, e.target.value as never)}
              >
                <option value="character_only">僅限此角色</option>
                <option value="conversation_only">僅限此對話</option>
                <option value="shared">與所有角色共享</option>
              </select>
            </div>
          </div>

          <div className="cs-section">
            <h3 className="cs-section__title">敏感資料權限</h3>
            <p className="cs-section__hint">
              敏感資料必須明確逐項授權。勾選「記憶讀取」不會自動放行以下敏感類別。
            </p>
            <div className="cs-sensitive-grid">
              {([
                { key: 'health', label: '健康資料' },
                { key: 'period', label: '生理週期' },
                { key: 'finance', label: '財務資料' },
                { key: 'privateJournal', label: '私密手記' },
                { key: 'preciseLocation', label: '精確位置' },
                { key: 'otherCharacterSessions', label: '其他角色私密對話' },
              ] as const).map(({ key, label }) => {
                const perms = draft.sensitiveDataPermissions || {};
                const checked = perms[key as keyof typeof perms] ?? false;
                return (
                  <div key={key} className="cs-sensitive-item">
                    <span className="cs-sensitive-item__label">{label}</span>
                    <label className="cs-toggle">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = { ...(draft.sensitiveDataPermissions || {}), [key]: e.target.checked };
                          updateField('sensitiveDataPermissions' as keyof CharacterProfile, next as never);
                        }}
                      />
                      <span className="cs-toggle__track">
                        <span className="cs-toggle__thumb" />
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // =========================================================
    // Tab 5: 進階
    // =========================================================
    case 'advanced': {
      const hasModel = providers && providers.length > 0;

      return (
        <div>
          <div className="cs-section">
            <h3 className="cs-section__title">System Prompt</h3>
            <p className="cs-section__hint">
              直接寫入 AI 系統提示詞的區塊。優先級高於人格設定。留空則使用標準角色提示詞。
            </p>
            {textField('systemPrompt', 'System Prompt', {
              desc: '自訂系統提示詞，直接覆蓋角色提示。',
              placeholder: '例：你是一個…',
              area: true,
              maxLen: 2000,
            })}
          </div>

          <div className="cs-section">
            <h3 className="cs-section__title">AI 輔助</h3>
            <p className="cs-section__hint">
              {hasModel
                ? 'AI 建議僅顯示差異 (Diff)，不會直接覆寫設定。'
                : '尚未配置模型，AI 輔助功能不可用。仍可手動建立角色。'}
            </p>
            {hasModel && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" className="cs-footer__btn" disabled>
                  整理設定 (Coming Soon)
                </button>
                <button type="button" className="cs-footer__btn" disabled>
                  檢查重複 (Coming Soon)
                </button>
                <button type="button" className="cs-footer__btn" disabled>
                  建議問候語 (Coming Soon)
                </button>
                <button type="button" className="cs-footer__btn" disabled>
                  測試語氣 (Coming Soon)
                </button>
              </div>
            )}
            {aiSuggestion && (
              <div className="cs-diff-overlay">
                <div className="cs-diff-header">
                  <span>AI 建議變更 — {aiSuggestion.field}</span>
                  <div className="cs-diff-actions">
                    <button onClick={() => setAiSuggestion(null)}>取消</button>
                    <button className="is-accept" onClick={applyAiSuggestion}>接受建議</button>
                  </div>
                </div>
                <div className="cs-diff-body">
                  <del>{aiSuggestion.current}</del>
                  {' → '}
                  <ins style={{ color: 'var(--accent)', textDecoration: 'none' }}>{aiSuggestion.suggested}</ins>
                </div>
              </div>
            )}
          </div>

          <div className="cs-section">
            <h3 className="cs-section__title">公開身份</h3>
            {toggleField('publicPersonaSettings' as keyof CharacterProfile, '設為公開角色', '公開角色可被其他使用者參考或使用（待客廳等功能）。')}
          </div>

          {/* Danger Zone */}
          {isEdit && (
            <div className="cs-danger-zone">
              <h3 className="cs-danger-zone__title">危險區域</h3>
              <p className="cs-danger-zone__desc">
                刪除角色不可逆。若角色已被歷史聊天引用，將保留訊息中的 participant snapshot 不破壞舊訊息。
                永久刪除需要確認。
              </p>
              <div className="cs-danger-zone__actions">
                <button
                  type="button"
                  className="cs-danger-btn"
                  onClick={() => {
                    if (draft.isBuiltIn) return;
                    archiveCharacter(draft.id);
                  }}
                  disabled={draft.isBuiltIn}
                >
                  {draft.isBuiltIn ? '內建角色不可封存' : '封存角色'}
                </button>
                <button
                  type="button"
                  className="cs-danger-btn"
                  onClick={() => {
                    if (draft.isBuiltIn) return;
                    if (window.confirm(`確定要永久刪除角色「${draft.name}」嗎？\n\n此操作不可逆。已在歷史聊天中的訊息將保留 snapshot。`)) {
                      deleteCharacter(draft.id);
                      onDeleted?.();
                    }
                  }}
                  disabled={draft.isBuiltIn}
                  title={draft.isBuiltIn ? '內建角色不可刪除' : undefined}
                >
                  永久刪除
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // =========================================================
    // Tab 6: 語音
    // =========================================================
    case 'voice': {
      return (
        <div>
          {!ttsConfigured ? (
            <div className="cs-section">
              <div className="cs-voice-empty-state">
                <div className="cs-voice-empty-state__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
                <h3 className="cs-section__title" style={{ textAlign: 'center' }}>角色語音尚未連接</h3>
                <p className="cs-section__hint" style={{ textAlign: 'center' }}>
                  設定語音服務後，才能選擇音色、試聽與設定自動播放。
                </p>
                <button
                  type="button"
                  className="cs-footer__btn cs-footer__btn--primary"
                  onClick={() => navigate('/settings/advanced/providers')}
                >
                  設定語音服務
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="cs-section">
                <h3 className="cs-section__title">提供者與音色</h3>
                <p className="cs-section__hint">
                  選擇角色使用的語音設定。音色被刪除時，自動退回角色文字模式。
                </p>
                {(() => textField('voiceProfileId' as keyof CharacterProfile, '語音設定 ID', {
                  desc: '對應 TTS provider 中的 voice profile id。',
                  placeholder: '例：voice-lunaris-default',
                  maxLen: 100,
                }))()}
              </div>

              <div className="cs-section">
                <h3 className="cs-section__title">音色試聽</h3>
                <div className="cs-field">
                  <label className="cs-field__label" htmlFor="cs-voiceName">音色名稱</label>
                  <input
                    id="cs-voiceName"
                    className="cs-field__input"
                    type="text"
                    value={voiceName}
                    onChange={(e) => {
                      setVoiceName(e.target.value);
                      updateField('voiceProfileId' as keyof CharacterProfile, e.target.value || undefined);
                    }}
                    placeholder="例：nova、echo、shimmer"
                  />
                </div>
                <div className="cs-field">
                  <label className="cs-field__label" htmlFor="cs-voiceLang">語言</label>
                  <select
                    id="cs-voiceLang"
                    className="cs-field__select"
                    value={voiceLanguage}
                    onChange={(e) => setVoiceLanguage(e.target.value)}
                  >
                    <option value="zh-TW">繁體中文</option>
                    <option value="zh-CN">簡體中文</option>
                    <option value="en-US">English</option>
                    <option value="ja-JP">日本語</option>
                    <option value="ko-KR">한국어</option>
                  </select>
                </div>
              </div>

              <div className="cs-section">
                <h3 className="cs-section__title">自動播放</h3>
                <p className="cs-section__hint">角色語音在什麼情況下自動朗讀。</p>
                <div className="cs-voice-segmented">
                  {([
                    ['never', '從不'],
                    ['short-only', '僅短回覆'],
                    ['always', '所有回覆'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`cs-voice-segmented-btn ${voiceAutoPlayMode === value ? 'is-active' : ''}`}
                      onClick={() => setVoiceAutoPlayMode(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cs-section">
                <button
                  type="button"
                  className="cs-footer__btn cs-footer__btn--primary"
                  disabled={voiceTestState === 'loading'}
                  onClick={voiceTestState === 'loading' ? handleStopTestVoice : handleTestVoice}
                >
                  {voiceTestState === 'loading' ? '停止試聽…' : voiceTestState === 'error' ? '重試' : '試聽'}
                </button>
                {voiceTestState === 'error' && <p className="cs-field__error" style={{ marginTop: 6 }}>{voiceTestError}</p>}
              </div>
            </>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
