import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent, type CSSProperties } from 'react';
import { compressImageFile } from '@/utils/imageCompression';
import { deleteWallpaper, getWallpaper, saveWallpaper, validateWallpaperFile } from '@/storage/wallpaperStorage';
import { useWallpaperStore } from '@/store/useWallpaperStore';
import { DEFAULT_WALLPAPER_SETTINGS, type WallpaperSettings } from '@/features/wallpaper/wallpaperTypes';
import '@/features/wallpaper/wallpaper.css';

type WallpaperRangeKey = 'brightness' | 'tintOpacity' | 'imageOpacity' | 'blur' | 'saturation' | 'scale' | 'positionX' | 'positionY';
const RANGE_FIELDS: Array<{ key: WallpaperRangeKey; label: string; min: number; max: number; step: number; suffix: string; factor?: number }> = [
  { key: 'brightness', label: '圖片亮度', min: 0.4, max: 1.6, step: 0.01, suffix: '%', factor: 100 },
  { key: 'tintOpacity', label: '暗色遮罩', min: 0, max: 0.85, step: 0.01, suffix: '%', factor: 100 },
  { key: 'imageOpacity', label: '圖片透明度', min: 0, max: 1, step: 0.01, suffix: '%', factor: 100 },
  { key: 'blur', label: '模糊度', min: 0, max: 30, step: 1, suffix: ' px' },
  { key: 'saturation', label: '飽和度', min: 0, max: 2, step: 0.01, suffix: '%', factor: 100 },
  { key: 'scale', label: '縮放', min: 1, max: 1.5, step: 0.01, suffix: '%', factor: 100 },
  { key: 'positionX', label: '位置 X', min: 0, max: 100, step: 1, suffix: '%' },
  { key: 'positionY', label: '位置 Y', min: 0, max: 100, step: 1, suffix: '%' },
];
const FIT_MODES: Array<{ value: 'cover' | 'contain'; label: string }> = [
  { value: 'cover', label: '填滿' },
  { value: 'contain', label: '完整顯示' },
];

function sameSettings(left: WallpaperSettings, right: WallpaperSettings): boolean {
  return Object.entries(left).every(([key, value]) => right[key as keyof WallpaperSettings] === value);
}

export function WallpaperSettingsPanel() {
  const applied = useWallpaperStore((state) => state.applied);
  const draft = useWallpaperStore((state) => state.draft);
  const beginDraft = useWallpaperStore((state) => state.beginDraft);
  const updateDraft = useWallpaperStore((state) => state.updateDraft);
  const applyDraft = useWallpaperStore((state) => state.applyDraft);
  const cancelDraft = useWallpaperStore((state) => state.cancelDraft);
  const restoreDefault = useWallpaperStore((state) => state.restoreDefault);
  const settings = draft ?? applied;
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewWallpaperIdRef = useRef<string | null>(null);
  const createdDraftIds = useRef(new Set<string>());
  const removeAfterApplyId = useRef<string | null>(null);
  const [inlineError, setInlineError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<'idle' | 'pressing' | 'success' | 'error'>('idle');
  const focusDragRef = useRef<{ pointerId: number; x: number; y: number; positionX: number; positionY: number; width: number; height: number } | null>(null);

  useEffect(() => {
    beginDraft();
    return () => {
      cancelDraft();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      createdDraftIds.current.forEach((id) => void deleteWallpaper(id));
    };
  }, [beginDraft, cancelDraft]);

  useEffect(() => {
    if (!settings.wallpaperId || previewWallpaperIdRef.current === settings.wallpaperId) return;
    let active = true;
    void getWallpaper(settings.wallpaperId, true).then((blob) => {
      if (!active || !blob) return;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      previewWallpaperIdRef.current = settings.wallpaperId;
      setLocalPreviewUrl(url);
    }).catch(() => setInlineError('無法讀取已保存的圖片，已改回無圖片預設。'));
    return () => { active = false; };
  }, [settings.wallpaperId]);

  const isDirty = useMemo(() => !sameSettings(settings, applied), [applied, settings]);
  const update = (patch: Partial<WallpaperSettings>) => { setInlineError(''); setNotice(''); updateDraft(patch); };

  const replaceLocalPreview = (file: File) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    previewWallpaperIdRef.current = null;
    setLocalPreviewUrl(url);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || working) return;
    const validationError = validateWallpaperFile(file);
    if (validationError) { setInlineError(validationError); return; }
    setWorking(true); setInlineError(''); setNotice(''); replaceLocalPreview(file);
    try {
      const original = await compressImageFile(file, { maxWidth: 2560, maxHeight: 2560, outputType: 'image/webp', quality: 0.88 });
      const thumbnail = await compressImageFile(file, { maxWidth: 420, maxHeight: 260, outputType: 'image/webp', quality: 0.72 });
      const id = await saveWallpaper(original, thumbnail, file);
      createdDraftIds.current.add(id);
      if (settings.wallpaperId && createdDraftIds.current.has(settings.wallpaperId)) {
        createdDraftIds.current.delete(settings.wallpaperId);
        await deleteWallpaper(settings.wallpaperId);
      }
      if (settings.wallpaperId && settings.wallpaperId === applied.wallpaperId) {
        removeAfterApplyId.current = settings.wallpaperId;
      }
      update({ wallpaperId: id, backgroundKind: 'custom' });
      previewWallpaperIdRef.current = id;
      setNotice('圖片已建立預覽，按下「套用」後才會保存設定。');
    } catch {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null; setLocalPreviewUrl(null);
      previewWallpaperIdRef.current = null;
      if (settings.wallpaperId) {
        const stored = await getWallpaper(settings.wallpaperId, true).catch(() => null);
        if (stored) {
          const restoredUrl = URL.createObjectURL(stored);
          previewUrlRef.current = restoredUrl;
          previewWallpaperIdRef.current = settings.wallpaperId;
          setLocalPreviewUrl(restoredUrl);
        }
      }
      setInlineError('圖片處理失敗。請確認檔案未損毀，或改用較小的 PNG、JPG、JPEG 或 WebP 圖片。');
    } finally { setWorking(false); }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => { void handleFile(event.target.files?.[0]); event.target.value = ''; };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) { setInlineError('沒有偵測到可用的圖片檔案，請重新拖曳或點擊選擇圖片。'); return; }
    void handleFile(file);
  };
  const removeImage = () => {
    if (settings.wallpaperId && settings.wallpaperId === applied.wallpaperId) removeAfterApplyId.current = settings.wallpaperId;
    if (settings.wallpaperId && createdDraftIds.current.has(settings.wallpaperId)) { createdDraftIds.current.delete(settings.wallpaperId); void deleteWallpaper(settings.wallpaperId); }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null; setLocalPreviewUrl(null); update({ wallpaperId: null }); setNotice('已移除草稿圖片，尚未保存。');
  };
  const cancel = () => { createdDraftIds.current.forEach((id) => void deleteWallpaper(id)); createdDraftIds.current.clear(); removeAfterApplyId.current = null; if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; setLocalPreviewUrl(null); cancelDraft(); beginDraft(); setInlineError(''); setNotice('已捨棄未套用的變更。'); };
  const reset = () => { if (settings.wallpaperId) removeImage(); restoreDefault(); setNotice('正在預覽無圖片的預設底色。'); };
  const apply = async () => {
    if (!isDirty || working) return;
    setApplyState('pressing'); setInlineError('');
    try {
      applyDraft();
      if (removeAfterApplyId.current) await deleteWallpaper(removeAfterApplyId.current).catch(() => undefined);
      removeAfterApplyId.current = null; createdDraftIds.current.clear();
      setApplyState('success'); setNotice('主題皮膚已套用。');
      window.setTimeout(() => setApplyState('idle'), 950);
    } catch {
      setApplyState('error'); setInlineError('保存失敗，圖片與目前設定尚未變更。請稍後再試。');
      window.setTimeout(() => setApplyState('idle'), 450);
    }
  };

  const startFocusDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!settings.wallpaperId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    focusDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, positionX: settings.positionX, positionY: settings.positionY, width: rect.width, height: rect.height };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  };
  const moveFocusDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = focusDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    update({ positionX: Math.max(0, Math.min(100, drag.positionX + ((event.clientX - drag.x) / drag.width) * 100)), positionY: Math.max(0, Math.min(100, drag.positionY + ((event.clientY - drag.y) / drag.height) * 100)) });
  };
  const endFocusDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (focusDragRef.current?.pointerId === event.pointerId) focusDragRef.current = null;
  };

  const previewImageStyle = localPreviewUrl ? {
    backgroundImage: `url(${JSON.stringify(localPreviewUrl)})`,
    backgroundSize: settings.fit === 'contain' ? 'contain' : 'cover',
    '--preview-image-opacity': settings.imageOpacity,
    '--preview-image-blur': `${settings.blur}px`,
    '--preview-image-brightness': settings.brightness,
    '--preview-image-saturation': settings.saturation,
    '--preview-image-scale': settings.scale,
    '--preview-image-x': `${settings.positionX}%`,
    '--preview-image-y': `${settings.positionY}%`,
    '--preview-tint': settings.tintColor,
    '--preview-tint-opacity': settings.tintOpacity,
  } as CSSProperties : undefined;
  return <div className="wallpaper-settings" data-testid="wallpaper-settings">
    <input ref={inputRef} className="wallpaper-file-input" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={onInputChange} />
    <div className="wallpaper-settings__intro"><strong>主題皮膚</strong><p>使用一張你選擇的圖片，為Rune換上一層只屬於你的光。</p></div>
    <section className="wallpaper-settings__section"><h3>背景來源</h3><div className="wallpaper-readability" role="radiogroup" aria-label="背景來源">{([['theme','主題底色'],['builtin','內建圖片'],['custom','本機圖片'],['solid','純色'],['gradient','漸層']] as const).map(([value,label]) => <button key={value} type="button" role="radio" aria-checked={settings.backgroundKind===value} className={settings.backgroundKind===value?'is-active':''} onClick={() => update({backgroundKind:value})}>{label}</button>)}</div>{settings.backgroundKind==='builtin' && <div className="wallpaper-readability" role="radiogroup" aria-label="內建背景">{([['moon-tide','Rune'],['misty-orbit','霧軌'],['quiet-dawn','靜曉']] as const).map(([value,label]) => <button key={value} type="button" role="radio" aria-checked={settings.builtinId===value} className={settings.builtinId===value?'is-active':''} onClick={() => update({builtinId:value})}>{label}</button>)}</div>}{settings.backgroundKind==='solid' && <label className="wallpaper-color-row"><span>背景色</span><input type="color" value={settings.solidColor} onChange={(event)=>update({solidColor:event.target.value})}/></label>}{settings.backgroundKind==='gradient' && <div className="wallpaper-range-grid"><label><span>起點色</span><input type="color" value={settings.gradientFrom} onChange={(event)=>update({gradientFrom:event.target.value})}/></label><label><span>終點色</span><input type="color" value={settings.gradientTo} onChange={(event)=>update({gradientTo:event.target.value})}/></label><label><span>角度<output>{settings.gradientAngle}°</output></span><input type="range" min="0" max="360" value={settings.gradientAngle} onChange={(event)=>update({gradientAngle:Number(event.target.value)})}/></label></div>}</section>
    <div className={`wallpaper-settings__workspace${settings.wallpaperId ? ' has-image' : ''}`}>
      <aside className="skin-preview" aria-label="主題皮膚即時預覽">
        <div className="skin-preview__label">即時預覽</div>
        {settings.wallpaperId ? <div className="skin-preview__device" onPointerDownCapture={startFocusDrag} onPointerMoveCapture={moveFocusDrag} onPointerUpCapture={endFocusDrag} onPointerCancelCapture={endFocusDrag} onDoubleClick={() => update({ positionX: 50, positionY: 50 })}>
          <div className="skin-preview__image" style={previewImageStyle} /><div className="skin-preview__image-mask" style={previewImageStyle} /><div className="skin-preview__sidebar"><b>Rune</b><span className="is-active">今日</span><span>對話</span><span>手記</span><span>設定</span></div>
          <div className="skin-preview__main"><header><strong>晚安，潮汐</strong><i /></header><div className="skin-preview__card"><small>今日節奏</small><b>留一點空白給自己。</b><span>晚上 8:40</span></div><div className="skin-preview__card skin-preview__card--small">月光正在替你收好今天的片段。</div><div className="skin-preview__chat"><div className="skin-preview__bubble skin-preview__bubble--user">今天過得怎麼樣？</div><div className="skin-preview__bubble skin-preview__bubble--agent">我幫你整理了今天的記憶片段，要看看嗎？</div></div><button type="button" className="skin-preview__button">儲存片段</button><div className="skin-preview__input">寫下此刻的心情… <em>↑</em></div></div>
          <nav className="skin-preview__dock"><span>首頁</span><span>對話</span><span className="is-active">＋</span><span>手記</span><span>我的</span></nav>
        </div> : <div className={`wallpaper-dropzone${dragging ? ' is-dragging' : ''}`} role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <span className="wallpaper-dropzone__icon">＋</span><strong>拖曳圖片到這裡</strong><span>或選擇本機圖片</span><small>支援 PNG、JPG、JPEG、WebP，檔案上限 20 MB</small>
        </div>}
      </aside>
      {settings.wallpaperId && <div className="wallpaper-settings__controls"><section className="wallpaper-settings__section wallpaper-image-actions"><h3>圖片皮膚</h3><p>拖曳左側預覽可調整焦點，雙擊恢復置中；所有草稿會暫時套用到整個 App。</p><div><button type="button" onClick={() => inputRef.current?.click()} disabled={working}>{working ? '正在處理圖片…' : '更換圖片'}</button><button type="button" onClick={removeImage} disabled={working}>移除圖片</button></div></section><section className="wallpaper-settings__section"><h3>適配模式</h3><div className="wallpaper-readability" role="group" aria-label="適配模式">{FIT_MODES.map(({ value, label }) => <button key={value} type="button" className={settings.fit === value ? 'is-active' : ''} onClick={() => update({ fit: value })}>{label}</button>)}</div></section><section className="wallpaper-settings__section"><h3>可讀性保護</h3><div className="wallpaper-readability" role="group" aria-label="可讀性保護">{([['low', '低保護'], ['standard', '標準'], ['high', '高可讀']] as const).map(([value, label]) => <button key={value} type="button" className={settings.readabilityMode === value ? 'is-active' : ''} onClick={() => update({ readabilityMode: value })}>{label}</button>)}</div></section><section className="wallpaper-settings__section"><h3>畫面調整</h3><div className="wallpaper-range-grid">{RANGE_FIELDS.map((field) => { const raw = settings[field.key] as number; return <label key={field.key}><span>{field.label}<output>{Math.round(raw * (field.factor ?? 1))}{field.suffix}</output></span><input type="range" aria-label={field.label} min={field.min} max={field.max} step={field.step} value={raw} onChange={(event) => update({ [field.key]: Number(event.target.value) })} /></label>; })}</div><label className="wallpaper-color-row"><span>遮罩色彩</span><input type="color" value={settings.tintColor} onChange={(event) => update({ tintColor: event.target.value })} /></label></section></div>}
    </div>
    {(inlineError || notice) && <p className={`wallpaper-settings__message${inlineError ? ' is-error' : ''}`} role="status">{inlineError || notice}</p>}
    <div className="wallpaper-settings__actions"><button type="button" className="wallpaper-reset" onClick={reset} disabled={working}>恢復預設</button><button type="button" className="wallpaper-cancel" onClick={cancel} disabled={!isDirty || working}>取消</button><button type="button" className={`wallpaper-apply is-${applyState}`} onPointerDown={() => setApplyState('pressing')} onPointerUp={() => setApplyState('idle')} onPointerCancel={() => setApplyState('idle')} onPointerLeave={() => { if (applyState === 'pressing') setApplyState('idle'); }} onClick={() => void apply()} disabled={!isDirty || working}>{applyState === 'success' ? <><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5" /></svg>已套用</> : '套用'}<span aria-hidden="true" /></button></div>
  </div>;
}
