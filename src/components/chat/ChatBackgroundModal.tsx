import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ChatBackground } from '@/config/chatBackground'
import { loadBackground, saveBackground, PRESETS, DEFAULT_BG } from '@/config/chatBackground'

interface Props {
  open: boolean
  onClose: () => void
  onChange: (bg: ChatBackground) => void
}

export function ChatBackgroundModal({ open, onClose, onChange }: Props) {
  const [bg, setBg] = useState<ChatBackground>(loadBackground)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const update = (patch: Partial<ChatBackground>) => setBg(prev => ({ ...prev, ...patch }))

  const apply = () => {
    saveBackground(bg)
    onChange(bg)
    onClose()
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update({ type: 'image', imageDataUrl: reader.result as string })
    reader.readAsDataURL(file)
  }

  const reset = () => {
    const d = { ...DEFAULT_BG }
    setBg(d)
    saveBackground(d)
    onChange(d)
    onClose()
  }

  const previewStyle: React.CSSProperties = (() => {
    if (bg.type === 'preset') {
      const css = PRESETS[bg.preset].css
      return css === 'none' ? { background: 'var(--bg-main)' } : { background: css }
    }
    if (bg.type === 'image' && bg.imageDataUrl) {
      return { backgroundImage: `url(${bg.imageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    }
    return { background: 'var(--bg-main)' }
  })()

  return createPortal(
    <div className="quick-sheet-overlay active" onClick={onClose}>
      <div className="quick-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <span className="quick-sheet-title">Chat Background</span>
        </div>

        <div className="quick-sheet-body" style={{ gap: 12 }}>
          {/* Type tabs */}
          <div className="bg-type-tabs">
            <button className={`bg-type-tab ${bg.type === 'preset' ? 'active' : ''}`} onClick={() => update({ type: 'preset' })}>Presets</button>
            <button className={`bg-type-tab ${bg.type === 'image' ? 'active' : ''}`} onClick={() => update({ type: 'image' })}>Image</button>
          </div>

          {/* Presets */}
          {bg.type === 'preset' && (
            <div className="bg-presets">
              {(Object.entries(PRESETS) as [string, { label: string; labelZh: string; css: string }][]).map(([key, p]) => (
                <button
                  key={key}
                  className={`bg-preset-tile ${bg.preset === key ? 'active' : ''}`}
                  onClick={() => update({ preset: key as ChatBackground['preset'] })}
                >
                  <div className="bg-preset-swatch" style={{ background: p.css }} />
                  <span className="bg-preset-label">{p.labelZh}</span>
                </button>
              ))}
            </div>
          )}

          {/* Image upload */}
          {bg.type === 'image' && (
            <div className="bg-upload-area">
              {bg.imageDataUrl ? (
                <>
                  <div className="bg-upload-preview" style={{ backgroundImage: `url(${bg.imageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} style={{ flex: 1 }}>Change image</button>
                    <button type="button" className="btn-ghost" onClick={() => update({ imageDataUrl: '' })} style={{ color: 'var(--danger)' }}>Remove</button>
                  </div>
                </>
              ) : (
                <button type="button" className="bg-upload-btn" onClick={() => fileRef.current?.click()}>
                  <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload image (JPG, PNG, WebP)
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} style={{ display: 'none' }} />
            </div>
          )}

          {/* Opacity */}
          <div className="bg-control">
            <label className="bg-control-label">Opacity</label>
            <input type="range" min={10} max={100} value={bg.opacity} onChange={e => update({ opacity: Number(e.target.value) })} className="bg-range" />
            <span className="bg-control-val">{bg.opacity}%</span>
          </div>

          {/* Blur */}
          <div className="bg-control">
            <label className="bg-control-label">Blur</label>
            <input type="range" min={0} max={50} value={bg.blur} onChange={e => update({ blur: Number(e.target.value) })} className="bg-range" />
            <span className="bg-control-val">{bg.blur}px</span>
          </div>

          {/* Preview */}
          <div className="bg-preview" style={{
            opacity: bg.opacity / 100,
            filter: bg.blur > 0 ? `blur(${bg.blur}px)` : undefined,
            ...previewStyle,
          }} />
        </div>

        <div className="quick-sheet-actions">
          <button type="button" className="btn-ghost" onClick={reset}>Reset</button>
          <button type="button" className="btn-primary" onClick={apply}>Apply</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
