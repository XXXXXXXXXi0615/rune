import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { getAsset, savePortableAsset } from '@/store/assets';
import type { BubbleSkinInsets, BubbleSkinSlice, BubbleSkinSource, ChatBubbleSkin, ImageBubbleSkin } from '@/features/chat/bubbleSkin/types';
import { importRuneSkinAssets, parseRuneSkinPackage, validateRuneSkinPackage } from '@/features/chat/bubbleSkin/runeSkinImporter';
import { exportRuneSkinPackage } from '@/features/chat/bubbleSkin/runeSkinExporter';

type Side = 'self' | 'other';
type Size = { width: number; height: number };
interface Props { value: ChatBubbleSkin; savedSkin?: ChatBubbleSkin; onDraft: (skin: ChatBubbleSkin) => void; onSave: () => void; onCancel: () => void }
const emptyImage = (): ImageBubbleSkin => ({ mode: 'image', source: { kind: 'asset', assetId: '' }, slice: { top: 0, right: 0, bottom: 0, left: 0 }, insets: { top: 12, right: 18, bottom: 12, left: 18 }, mirror: { allowed: false }, tail: { kind: 'image-integrated' }, edgeMode: 'stretch' });
const assetId = (source?: BubbleSkinSource) => source?.kind === 'asset' ? source.assetId : '';
const sourceFor = (skin: ImageBubbleSkin, side: Side) => side === 'self' ? skin.mirror.rightAsset || skin.source : skin.mirror.leftAsset;
async function dimensions(blob: Blob): Promise<Size> { const bitmap = await createImageBitmap(blob); const size = { width: bitmap.width, height: bitmap.height }; bitmap.close(); return size; }

function AssetPreview({ source, label, onPick, onRemove, onSize }: { source?: BubbleSkinSource; label: string; onPick: (file: File) => void; onRemove: () => void; onSize: (size: Size) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState<{ url: string; type: string; size: Size } | null>(null);
  const id = assetId(source);
  const reportSize = useEffectEvent(onSize);
  useEffect(() => {
    let url = '';
    let cancelled = false;
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInfo(null);
      return;
    }
    getAsset(id).then(async (blob) => {
      if (!blob || cancelled) return;
      url = URL.createObjectURL(blob);
      const size = await dimensions(blob);
      setInfo({ url, type: blob.type || 'image', size });
      reportSize(size);
    }).catch(() => setInfo(null));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return <article className="cts-skin-asset"><div className="cts-skin-thumb">{info ? <img src={info.url} alt="" /> : <span>尚未選擇圖片</span>}</div><div><strong>{label}</strong><small>{info ? `${info.type.replace('image/', '').toUpperCase()} · ${info.size.width} × ${info.size.height}` : 'PNG / JPEG / WebP'}</small></div><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label={`選擇${label}圖片`} onChange={(event) => { const file = event.target.files?.[0]; if (file) onPick(file); event.target.value = ''; }}/><button type="button" onClick={() => input.current?.click()}>{id ? '替換' : '選擇圖片'}</button>{id && <button type="button" onClick={onRemove}>移除</button>}</article>;
}

function BoxEditor({ title, value, max, onChange }: { title: string; value: BubbleSkinSlice; max: Size; onChange: (value: BubbleSkinSlice) => void }) {
  const keys = ['top', 'right', 'bottom', 'left'] as const; const limits = { top: max.height, bottom: max.height, left: max.width, right: max.width };
  return <section className="cts-skin-box-editor"><header><strong>{title}</strong><small>{title.includes('切片') ? '保留邊角與中央延展區' : '文字安全區域'}</small></header><div className="cts-skin-guide" aria-hidden="true"><i style={{ inset: `${Math.min(value.top, 45)}% ${Math.min(value.right, 45)}% ${Math.min(value.bottom, 45)}% ${Math.min(value.left, 45)}%` }}/></div><div className="cts-skin-ranges">{keys.map((key) => <label key={key}><span>{{ top: '上', right: '右', bottom: '下', left: '左' }[key]} <output>{value[key]}</output></span><span className="cts-skin-range-inputs"><input type="range" aria-label={`${title} ${key}`} min="0" max={limits[key]} value={value[key]} onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })}/><input type="number" aria-label={`${title} ${key} 數值`} min="0" max={limits[key]} value={value[key]} onChange={(event) => onChange({ ...value, [key]: Math.max(0, Math.min(limits[key], Number(event.target.value))) })}/></span></label>)}</div></section>;
}

export function BubbleSkinStudioSection({ value, savedSkin, onDraft, onSave, onCancel }: Props) {
  const [error, setError] = useState(''); const [status, setStatus] = useState(''); const [sizes, setSizes] = useState<Record<Side, Size>>({ self: { width: 100, height: 100 }, other: { width: 100, height: 100 } }); const [linked, setLinked] = useState(false); const importInput = useRef<HTMLInputElement>(null); const image = value.mode === 'image' ? value : null; const unsupportedTail = image?.tail.kind === 'separate-image';
  const updateImage = (patch: Partial<ImageBubbleSkin>) => { if (image) onDraft({ ...image, ...patch }); };
  const setSide = (side: Side, source?: BubbleSkinSource) => { if (!image) return; if (side === 'self') updateImage({ source: source || { kind: 'asset', assetId: '' }, mirror: { ...image.mirror, rightAsset: source } }); else updateImage({ mirror: { ...image.mirror, leftAsset: source } }); };
  const pick = async (side: Side, file: File) => { setError(''); try { if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('只支援 PNG、JPEG 或 WebP。'); const nextSize = await dimensions(file); const id = await savePortableAsset(file, file.type); setSizes((current) => ({ ...current, [side]: nextSize })); setSide(side, { kind: 'asset', assetId: id }); } catch (reason) { setError(reason instanceof Error ? reason.message : '圖片無法讀取。'); } };
  const validateDraft = () => { if (!image) return true; if (!assetId(sourceFor(image, 'self'))) { setError('請選擇「我的氣泡」圖片。'); return false; } if (!image.mirror.allowed && !assetId(sourceFor(image, 'other'))) { setError('請選擇「Rune 的氣泡」圖片，或允許另一側鏡像。'); return false; } if ([sizes.self, ...(!image.mirror.allowed && assetId(sourceFor(image, 'other')) ? [sizes.other] : [])].some((imageSize) => image.slice.left + image.slice.right > imageSize.width || image.slice.top + image.slice.bottom > imageSize.height)) { setError('切片尺寸超過圖片範圍。'); return false; } if (unsupportedTail) { setError('獨立尾巴圖片目前沒有 canonical asset reference。'); return false; } return true; };
  const importPackage = async (file: File) => { setError(''); setStatus(''); try { const result = await importRuneSkinAssets(await validateRuneSkinPackage(await parseRuneSkinPackage(file))); onDraft(result.skin); setStatus('套件已載入草稿，儲存後才會套用。'); } catch (reason) { setError(reason instanceof Error ? reason.message : '無法匯入套件。'); } };
  const exportSaved = async () => { setError(''); try { const result = await exportRuneSkinPackage(savedSkin || { mode: 'css' }, { name: 'Rune Bubble Skin' }); const url = URL.createObjectURL(result.blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.filename; anchor.click(); queueMicrotask(() => URL.revokeObjectURL(url)); setStatus('已匯出已儲存的氣泡外觀。'); } catch (reason) { setError(reason instanceof Error ? reason.message : '無法匯出。'); } };
  const setInsets = (next: BubbleSkinInsets) => updateImage({ insets: linked ? { top: next.top, right: next.top, bottom: next.top, left: next.top } : next });
  return <section className="cts-skin-studio" aria-label="氣泡外觀編輯器"><header><div><h3>氣泡外觀</h3><p>變更只存在於草稿，按下儲存後才套用。</p></div><div className="cts-skin-tools"><input ref={importInput} type="file" accept=".runeskin,application/zip" aria-label="匯入 .runeskin" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importPackage(file); event.target.value = ''; }}/><button type="button" onClick={() => importInput.current?.click()}>匯入 .runeskin</button><button type="button" onClick={() => void exportSaved()}>匯出已儲存外觀</button></div></header><div className="cts-segments" role="group" aria-label="氣泡模式"><button type="button" className={value.mode === 'css' ? 'is-active' : ''} onClick={() => onDraft({ mode: 'css' })}>預設 / CSS</button><button type="button" className={value.mode === 'image' ? 'is-active' : ''} onClick={() => onDraft(image || emptyImage())}>圖片外觀</button></div>{image && <><div className="cts-skin-assets"><AssetPreview source={sourceFor(image, 'self')} label="我的氣泡" onPick={(file) => void pick('self', file)} onRemove={() => setSide('self')} onSize={(next) => setSizes((current) => current.self.width === next.width && current.self.height === next.height ? current : { ...current, self: next })}/><AssetPreview source={sourceFor(image, 'other')} label="Rune 的氣泡" onPick={(file) => void pick('other', file)} onRemove={() => setSide('other')} onSize={(next) => setSizes((current) => current.other.width === next.width && current.other.height === next.height ? current : { ...current, other: next })}/></div><label className="cts-skin-check"><input type="checkbox" checked={image.mirror.allowed} onChange={(event) => updateImage({ mirror: { ...image.mirror, allowed: event.target.checked } })}/><span>另一側允許鏡像</span></label><BoxEditor title="9-slice 切片" value={image.slice} max={sizes.self} onChange={(slice) => updateImage({ slice })}/><div className="cts-skin-inset-head"><span>內容安全間距</span><label><input type="checkbox" checked={linked} onChange={(event) => setLinked(event.target.checked)}/>四邊連動</label></div><BoxEditor title="內容間距" value={image.insets} max={sizes.self} onChange={setInsets}/><label className="cts-skin-select"><span>尾巴</span><select value={unsupportedTail ? 'separate-image' : image.tail.kind} onChange={(event) => updateImage({ tail: { kind: event.target.value as ImageBubbleSkin['tail']['kind'] } })}><option value="css">CSS 尾巴</option><option value="image-integrated">整合於圖片</option><option value="none">無尾巴</option>{unsupportedTail && <option value="separate-image">獨立圖片（不支援）</option>}</select></label>{unsupportedTail && <p className="cts-skin-warning">目前資料使用獨立尾巴圖片，但 canonical schema 沒有 tail asset reference。</p>}</>}<div className="cts-skin-feedback" aria-live="polite">{error && <p className="is-error">{error}</p>}{status && <p>{status}</p>}</div><footer className="cts-skin-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" className="is-primary" onClick={() => { setError(''); if (validateDraft()) { onSave(); setStatus('已儲存氣泡外觀。'); } }}>儲存</button></footer></section>;
}
