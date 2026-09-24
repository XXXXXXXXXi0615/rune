import { useState, useCallback, useRef, useEffect } from 'react';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import type { CallAppearance, CallVideoScene, CallMode, PipCorner } from '@/types/call';
import { DEFAULT_VIDEO_SCENE } from '@/types/call';
import { saveAsset } from '@/store/assets';
import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';
import { AppSwitch } from '@/components/ui/AppPrimitives';
import './CallSettingsSheet.css';

interface CallSettingsSheetProps {
  appearance: CallAppearance;
  callMode?: CallMode;
  videoScene?: CallVideoScene;
  onApply: (patch: Partial<CallAppearance>) => void;
  onApplyVideoScene?: (patch: Partial<CallVideoScene>) => void;
  onResetVideoScene?: () => void;
  onResetAll?: () => void;
  onClose: () => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const VALID_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const PIP_CORNER_LABELS: Record<PipCorner, string> = {
  'left-top': '左上',
  'right-top': '右上',
  'left-bottom': '左下',
  'right-bottom': '右下',
};
const PIP_CORNERS: PipCorner[] = ['left-top', 'right-top', 'left-bottom', 'right-bottom'];

export function CallSettingsSheet({
  appearance, callMode, videoScene,
  onApply, onApplyVideoScene, onResetVideoScene, onResetAll, onClose,
}: CallSettingsSheetProps) {
  // ── Appearance state ──
  const [bgId, setBgId] = useState(appearance.backgroundAssetId ?? '');
  const [bgFit, setBgFit] = useState<NonNullable<CallAppearance['backgroundFit']>>(appearance.backgroundFit ?? 'cover');
  const [bgX, setBgX] = useState(appearance.backgroundPositionX ?? 50);
  const [bgY, setBgY] = useState(appearance.backgroundPositionY ?? 50);
  const [bgOpacity, setBgOpacity] = useState(appearance.backgroundOpacity ?? 1);
  const [overlayOn, setOverlayOn] = useState(appearance.overlayEnabled ?? true);
  const [overlayOpacity, setOverlayOpacity] = useState(appearance.overlayOpacity ?? 0.42);
  const [blur, setBlur] = useState(appearance.backdropBlur ?? 3);
  const [tone, setTone] = useState(appearance.tone);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstCtrlRef = useRef<HTMLButtonElement>(null);

  // ── Video scene state ──
  const vs = videoScene ?? DEFAULT_VIDEO_SCENE;
  const [partnerBgId, setPartnerBgId] = useState(vs.partnerVideoAssetId ?? '');
  const [selfBgId, setSelfBgId] = useState(vs.selfVideoAssetId ?? '');
  const [partnerFit, setPartnerFit] = useState(vs.partnerFit);
  const [partnerX, setPartnerX] = useState(vs.partnerPositionX);
  const [partnerY, setPartnerY] = useState(vs.partnerPositionY);
  const [selfFit, setSelfFit] = useState(vs.selfFit);
  const [selfX, setSelfX] = useState(vs.selfPositionX);
  const [selfY, setSelfY] = useState(vs.selfPositionY);
  const [selfMirror, setSelfMirror] = useState(vs.selfMirror);
  const [selfPreviewVisible, setSelfPreviewVisible] = useState(vs.selfPreviewVisible);
  const [pipCorner, setPipCorner] = useState(vs.pipCorner);
  const [vidUploading, setVidUploading] = useState<'partner' | 'self' | null>(null);
  const partnerFileRef = useRef<HTMLInputElement>(null);
  const selfFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; positionX: number; positionY: number } | null>(null);

  const bgUrl = useAssetBlobUrl(bgId);
  const partnerPreviewUrl = useAssetBlobUrl(partnerBgId);
  const selfPreviewUrl = useAssetBlobUrl(selfBgId);

  // Video visuals are write-through canonical state. Closing with X/backdrop must
  // never leave the preview showing an asset that the Call Stage cannot read.
  useEffect(() => {
    if (callMode !== 'video' || !onApplyVideoScene) return;
    onApplyVideoScene({
      partnerVideoAssetId: partnerBgId || undefined,
      selfVideoAssetId: selfBgId || undefined,
      partnerFit,
      partnerPositionX: partnerX,
      partnerPositionY: partnerY,
      selfFit,
      selfPositionX: selfX,
      selfPositionY: selfY,
      selfMirror,
      selfPreviewVisible,
      pipCorner,
    });
  }, [callMode, onApplyVideoScene, partnerBgId, selfBgId, partnerFit, partnerX, partnerY, selfFit, selfX, selfY, selfMirror, selfPreviewVisible, pipCorner]);

  // Focus trap
  useEffect(() => {
    firstCtrlRef.current?.focus();
  }, []);

  // Escape → close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Upload handlers ──
  const doUpload = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (id: string) => void,
    setUploadingFlag: (v: boolean) => void,
    resetInput: () => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!VALID_TYPES.includes(file.type)) { alert('僅支援 PNG、JPEG、WebP 格式'); return; }
    if (file.size > MAX_FILE_SIZE) { alert('圖片不能超過 20 MB'); return; }
    setUploadingFlag(true);
    try {
      const id = await saveAsset(file, file.type);
      setter(id);
    } catch {
      alert('上傳失敗，請重試');
    } finally {
      setUploadingFlag(false);
      resetInput();
    }
  }, []);

  const handleBgUpload = useCallback(() => fileRef.current?.click(), []);
  const handleBgFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    doUpload(e, setBgId, setUploading, () => { if (fileRef.current) fileRef.current.value = ''; }),
    [doUpload]);

  const handlePartnerFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    doUpload(e, setPartnerBgId, (v) => setVidUploading(v ? 'partner' : null), () => { if (partnerFileRef.current) partnerFileRef.current.value = ''; }),
    [doUpload]);

  const handleSelfFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    doUpload(e, setSelfBgId, (v) => setVidUploading(v ? 'self' : null), () => { if (selfFileRef.current) selfFileRef.current.value = ''; }),
    [doUpload]);

  const beginPositionDrag = useCallback((event: React.PointerEvent<HTMLDivElement>, positionX: number, positionY: number) => {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, positionX, positionY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = 'true';
  }, []);

  const movePositionDrag = useCallback((event: React.PointerEvent<HTMLDivElement>, setX: (value: number) => void, setY: (value: number) => void) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
    setX(clamp(drag.positionX + ((event.clientX - drag.x) / Math.max(rect.width, 1)) * 100));
    setY(clamp(drag.positionY + ((event.clientY - drag.y) / Math.max(rect.height, 1)) * 100));
  }, []);

  const endPositionDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    delete event.currentTarget.dataset.dragging;
    dragRef.current = null;
  }, []);

  const handleRemoveBg = useCallback(() => {
    setBgId('');
    setBgFit('cover');
    setBgX(50);
    setBgY(50);
    setBgOpacity(1);
  }, []);

  const handleRemovePartner = useCallback(() => {
    setPartnerBgId('');
    setPartnerFit(DEFAULT_VIDEO_SCENE.partnerFit);
    setPartnerX(DEFAULT_VIDEO_SCENE.partnerPositionX);
    setPartnerY(DEFAULT_VIDEO_SCENE.partnerPositionY);
  }, []);

  const handleRemoveSelf = useCallback(() => {
    setSelfBgId('');
    setSelfFit(DEFAULT_VIDEO_SCENE.selfFit);
    setSelfX(DEFAULT_VIDEO_SCENE.selfPositionX);
    setSelfY(DEFAULT_VIDEO_SCENE.selfPositionY);
    setSelfMirror(DEFAULT_VIDEO_SCENE.selfMirror);
    setSelfPreviewVisible(DEFAULT_VIDEO_SCENE.selfPreviewVisible);
  }, []);

  // ── Reset all ──
  const handleResetAll = useCallback(() => {
    setBgId('');
    setBgFit('cover');
    setBgX(50);
    setBgY(50);
    setBgOpacity(1);
    setOverlayOn(true);
    setOverlayOpacity(0.42);
    setBlur(3);
    setTone('warm');
    setPartnerBgId('');
    setSelfBgId('');
    setPartnerFit(DEFAULT_VIDEO_SCENE.partnerFit);
    setPartnerX(DEFAULT_VIDEO_SCENE.partnerPositionX);
    setPartnerY(DEFAULT_VIDEO_SCENE.partnerPositionY);
    setSelfFit(DEFAULT_VIDEO_SCENE.selfFit);
    setSelfX(DEFAULT_VIDEO_SCENE.selfPositionX);
    setSelfY(DEFAULT_VIDEO_SCENE.selfPositionY);
    setSelfMirror(DEFAULT_VIDEO_SCENE.selfMirror);
    setSelfPreviewVisible(DEFAULT_VIDEO_SCENE.selfPreviewVisible);
    setPipCorner(DEFAULT_VIDEO_SCENE.pipCorner);
    onResetAll?.();
  }, [onResetAll]);

  const handleSave = useCallback(() => {
    onApply({
      backgroundAssetId: bgId || undefined,
      backgroundFit: bgFit,
      backgroundPositionX: bgX,
      backgroundPositionY: bgY,
      backgroundOpacity: bgOpacity,
      overlayEnabled: overlayOn,
      overlayOpacity,
      backdropBlur: blur,
      tone,
    });
    if (callMode === 'video' && onApplyVideoScene) {
      onApplyVideoScene({
        partnerVideoAssetId: partnerBgId || undefined,
        selfVideoAssetId: selfBgId || undefined,
        partnerFit,
        partnerPositionX: partnerX,
        partnerPositionY: partnerY,
        selfFit,
        selfPositionX: selfX,
        selfPositionY: selfY,
        selfMirror,
        selfPreviewVisible,
        pipCorner,
      });
    }
    onClose();
  }, [bgId, bgFit, bgX, bgY, bgOpacity, overlayOn, overlayOpacity, blur, tone,
      callMode, partnerBgId, selfBgId, partnerFit, partnerX, partnerY,
      selfFit, selfX, selfY, selfMirror, selfPreviewVisible, pipCorner,
      onApply, onApplyVideoScene, onClose]);

  const sheet = (
    <MobileShellOverlay variant="sheet" onClose={onClose} className="cc-settings-backdrop">
      <div className="cc-settings-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label="通話設定">
        <header className="cc-settings-header">
          <div className="cc-settings-handle" aria-hidden="true" />
          <h3 className="cc-settings-title">{callMode === 'video' ? '視訊設定' : '通話設定'}</h3>
          <button type="button" className="cc-settings-close" onClick={onClose} aria-label="關閉通話設定">×</button>
        </header>
        <div className="cc-settings-body">

        {/* ═══ Section: 外觀 ═══ */}
        <h4 className="cc-settings-section-head">外觀</h4>

        {/* Background preview */}
        <div className="cc-settings-sec">
          <div className="cc-settings-label">背景</div>
          <div className="cc-settings-preview" aria-label="背景預覽">
            {bgUrl ? (
              <img src={bgUrl} alt="背景預覽" style={{ objectFit: bgFit, objectPosition: `${bgX}% ${bgY}%` }} />
            ) : (
              <span className="cc-settings-preview-empty">無背景</span>
            )}
          </div>
          <div className="cc-settings-chips" style={{ marginTop: 10 }}>
            <button type="button" ref={firstCtrlRef} className="cc-settings-chip" onClick={handleBgUpload} disabled={uploading}>
              {uploading ? '上傳中…' : '上傳圖片'}
            </button>
            <button type="button" className="cc-settings-chip" onClick={handleRemoveBg} disabled={!bgId}>
              移除
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleBgFile} tabIndex={-1} aria-label="上傳背景圖片" />
        </div>

        {/* Background Fit */}
        <div className="cc-settings-sec">
          <div className="cc-settings-label">適應</div>
          <div className="cc-settings-chips">
            <button type="button" className={`cc-settings-chip${bgFit === 'cover' ? ' is-on' : ''}`} onClick={() => setBgFit('cover')} aria-label="圖片填滿畫面">
              圖片填滿畫面
            </button>
            <button type="button" className={`cc-settings-chip${bgFit === 'contain' ? ' is-on' : ''}`} onClick={() => setBgFit('contain')} aria-label="完整顯示圖片">
              完整顯示
            </button>
          </div>
        </div>

        {/* Position */}
        <div className="cc-settings-sec">
          <div className="cc-settings-label">調整位置：{bgX}% / {bgY}%</div>
          <div className="cc-settings-slider-grid">
            <label>X<input type="range" min={0} max={100} value={bgX} onChange={(e) => setBgX(Number(e.target.value))} className="cc-settings-range" aria-label="背景 X 偏移" /></label>
            <label>Y<input type="range" min={0} max={100} value={bgY} onChange={(e) => setBgY(Number(e.target.value))} className="cc-settings-range" aria-label="背景 Y 偏移" /></label>
          </div>
        </div>

        {/* Background Opacity */}
        <div className="cc-settings-sec">
          <div className="cc-settings-label">背景透明度：{Math.round(bgOpacity * 100)}%</div>
          <input type="range" min={0} max={100} step={5} value={Math.round(bgOpacity * 100)} onChange={(e) => setBgOpacity(Number(e.target.value) / 100)} className="cc-settings-range" aria-label="背景透明度" />
        </div>

        {/* Overlay */}
        <div className="cc-settings-sec">
          <div className="cc-settings-label">蒙層</div>
          <div className="cc-settings-chips">
            <button type="button" className={`cc-settings-chip${overlayOn ? ' is-on' : ''}`} onClick={() => setOverlayOn(true)}>開</button>
            <button type="button" className={`cc-settings-chip${!overlayOn ? ' is-on' : ''}`} onClick={() => setOverlayOn(false)}>關</button>
          </div>
        </div>

        {/* Overlay Opacity */}
        <div className="cc-settings-sec">
          <div className="cc-settings-label">暗度：{Math.round(overlayOpacity * 100)}%</div>
          <input type="range" min={0} max={80} step={5} value={Math.round(overlayOpacity * 100)} onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)} className="cc-settings-range" aria-label="蒙層暗度" />
        </div>

        {/* Blur */}
        <div className="cc-settings-sec">
          <div className="cc-settings-label">模糊：{blur}px</div>
          <input type="range" min={0} max={24} step={1} value={blur} onChange={(e) => setBlur(Number(e.target.value))} className="cc-settings-range" aria-label="背景模糊" />
        </div>

        {/* Tone */}
        <div className="cc-settings-sec">
          <div className="cc-settings-label">色調</div>
          <div className="cc-settings-chips cc-settings-chips--tri">
            <button type="button" className={`cc-settings-chip${tone === 'warm' ? ' is-on' : ''}`} onClick={() => setTone('warm')}>暖色</button>
            <button type="button" className={`cc-settings-chip${tone === 'neutral' ? ' is-on' : ''}`} onClick={() => setTone('neutral')}>中性</button>
            <button type="button" className={`cc-settings-chip${tone === 'cool' ? ' is-on' : ''}`} onClick={() => setTone('cool')}>冷色</button>
          </div>
        </div>

        {/* ═══ Section: 視訊 (video mode only) ═══ */}
        {callMode === 'video' && (
          <>
            <hr className="cc-settings-divider" />
            <h4 className="cc-settings-section-head">視訊</h4>

            {/* Partner Scene */}
            <div className="cc-settings-sec">
              <div className="cc-settings-label">對方畫面</div>
              <div className="cc-settings-subtitle">作為視訊通話中的主要畫面</div>
              <div
                className="cc-settings-preview cc-settings-preview--positionable"
                aria-label="對方視訊預覽"
                data-testid="partner-video-preview"
                onPointerDown={(event) => beginPositionDrag(event, partnerX, partnerY)}
                onPointerMove={(event) => movePositionDrag(event, setPartnerX, setPartnerY)}
                onPointerUp={endPositionDrag}
                onPointerCancel={endPositionDrag}
                onDoubleClick={() => { setPartnerX(50); setPartnerY(50); }}
              >
                {partnerPreviewUrl ? (
                  <img src={partnerPreviewUrl} alt="對方視訊預覽" style={{ objectFit: partnerFit, objectPosition: `${partnerX}% ${partnerY}%` }} />
                ) : (
                  <span className="cc-settings-preview-empty">未設定</span>
                )}
              </div>
              <div className="cc-settings-chips" style={{ marginTop: 10 }}>
                <label className={`cc-settings-chip cc-settings-upload${vidUploading === 'partner' ? ' is-disabled' : ''}`} htmlFor="cc-partner-video-upload">
                  {vidUploading === 'partner' ? '上傳中…' : '上傳圖片'}
                </label>
                <button type="button" className="cc-settings-chip" onClick={handleRemovePartner} disabled={!partnerBgId}>
                  移除
                </button>
              </div>
              <div className="cc-settings-chips" style={{ marginTop: 8 }}>
                <button type="button" className={`cc-settings-chip${partnerFit === 'cover' ? ' is-on' : ''}`} onClick={() => setPartnerFit('cover')} aria-label="圖片填滿畫面">
                  圖片填滿畫面
                </button>
                <button type="button" className={`cc-settings-chip${partnerFit === 'contain' ? ' is-on' : ''}`} onClick={() => setPartnerFit('contain')} aria-label="完整顯示圖片">
                  完整顯示
                </button>
              </div>
              <div className="cc-settings-label" style={{ marginTop: 8 }}>調整位置：{partnerX}% / {partnerY}%</div>
              <div className="cc-settings-slider-grid">
                <label>X<input type="range" min={0} max={100} value={partnerX} onChange={(e) => setPartnerX(Number(e.target.value))} className="cc-settings-range" aria-label="對方 X 偏移" /></label>
                <label>Y<input type="range" min={0} max={100} value={partnerY} onChange={(e) => setPartnerY(Number(e.target.value))} className="cc-settings-range" aria-label="對方 Y 偏移" /></label>
              </div>
              <button type="button" className="cc-settings-reset-position" onClick={() => { setPartnerX(50); setPartnerY(50); }}>重設位置</button>
              <input id="cc-partner-video-upload" ref={partnerFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="cc-settings-file-input" onChange={handlePartnerFile} disabled={vidUploading === 'partner'} aria-label="上傳對方畫面圖片" />
            </div>

            {/* Self Scene */}
            <div className="cc-settings-sec">
              <div className="cc-settings-label">我的畫面</div>
              <div
                className="cc-settings-preview cc-settings-preview--positionable"
                aria-label="我的視訊預覽"
                data-testid="self-video-preview"
                onPointerDown={(event) => beginPositionDrag(event, selfX, selfY)}
                onPointerMove={(event) => movePositionDrag(event, setSelfX, setSelfY)}
                onPointerUp={endPositionDrag}
                onPointerCancel={endPositionDrag}
                onDoubleClick={() => { setSelfX(50); setSelfY(50); }}
              >
                {selfPreviewUrl ? (
                  <img src={selfPreviewUrl} alt="我的視訊預覽" style={{ objectFit: selfFit, objectPosition: `${selfX}% ${selfY}%`, transform: selfMirror ? 'scaleX(-1)' : undefined }} />
                ) : (
                  <span className="cc-settings-preview-empty">未設定</span>
                )}
              </div>
              <div className="cc-settings-chips" style={{ marginTop: 10 }}>
                <label className={`cc-settings-chip cc-settings-upload${vidUploading === 'self' ? ' is-disabled' : ''}`} htmlFor="cc-self-video-upload">
                  {vidUploading === 'self' ? '上傳中…' : '上傳圖片'}
                </label>
                <button type="button" className="cc-settings-chip" onClick={handleRemoveSelf} disabled={!selfBgId}>
                  移除
                </button>
              </div>
              <div className="cc-settings-chips" style={{ marginTop: 8 }}>
                <button type="button" className={`cc-settings-chip${selfFit === 'cover' ? ' is-on' : ''}`} onClick={() => setSelfFit('cover')} aria-label="圖片填滿畫面">
                  圖片填滿畫面
                </button>
                <button type="button" className={`cc-settings-chip${selfFit === 'contain' ? ' is-on' : ''}`} onClick={() => setSelfFit('contain')} aria-label="完整顯示圖片">
                  完整顯示
                </button>
              </div>
              <div className="cc-settings-label" style={{ marginTop: 8 }}>調整位置：{selfX}% / {selfY}%</div>
              <div className="cc-settings-slider-grid">
                <label>X<input type="range" min={0} max={100} value={selfX} onChange={(e) => setSelfX(Number(e.target.value))} className="cc-settings-range" aria-label="我的畫面 X 偏移" /></label>
                <label>Y<input type="range" min={0} max={100} value={selfY} onChange={(e) => setSelfY(Number(e.target.value))} className="cc-settings-range" aria-label="我的畫面 Y 偏移" /></label>
              </div>
              <button type="button" className="cc-settings-reset-position" onClick={() => { setSelfX(50); setSelfY(50); }}>重設位置</button>

              {/* Mirror + Preview visibility switches */}
              <div className="cc-settings-switches" style={{ marginTop: 14 }}>
                <label className="cc-settings-switch-row">
                  <span className="cc-settings-switch-label">鏡像預覽</span>
                  <AppSwitch checked={selfMirror} onChange={setSelfMirror} label="鏡像預覽" />
                </label>
                <label className="cc-settings-switch-row">
                  <span className="cc-settings-switch-label">顯示我的小窗</span>
                  <AppSwitch checked={selfPreviewVisible} onChange={setSelfPreviewVisible} label="顯示我的小窗" />
                </label>
              </div>
              <input id="cc-self-video-upload" ref={selfFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="cc-settings-file-input" onChange={handleSelfFile} disabled={vidUploading === 'self'} aria-label="上傳我的畫面圖片" />
            </div>

            {/* PiP safe position */}
            {(selfPreviewVisible) && (
              <div className="cc-settings-sec">
                <div className="cc-settings-label">小窗位置</div>
                <div className="cc-settings-chips">
                  {PIP_CORNERS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`cc-settings-chip${pipCorner === c ? ' is-on' : ''}`}
                      onClick={() => setPipCorner(c)}
                    >
                      {PIP_CORNER_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        </div>
        <footer className="cc-settings-actions">
          <button type="button" className="cc-settings-chip cc-settings-actions-reset" onClick={handleResetAll}>
            恢復預設
          </button>
          <button type="button" className="cc-settings-done" onClick={handleSave}>
            完成
          </button>
        </footer>
      </div>
    </MobileShellOverlay>
  );

  return sheet;
}
