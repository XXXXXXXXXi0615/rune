import type { LinkPreview } from '@/features/interactive/linkPreviewService';

interface Props {
  preview: LinkPreview;
  onRemove?: () => void;
}

export function LinkPreviewCard({ preview, onRemove }: Props) {
  return (
    <div className="link-preview-card">
      <div className="link-preview-card__inner">
        {preview.thumbnailUrl && (
          <div className="link-preview-card__thumb">
            <img
              src={preview.thumbnailUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
            />
          </div>
        )}
        <div className="link-preview-card__copy">
          <a className="link-preview-card__title" href={preview.normalizedUrl} target="_blank" rel="noreferrer">
            {preview.title || preview.url}
          </a>
          {preview.description && (
            <p className="link-preview-card__desc">{preview.description}</p>
          )}
          <span className="link-preview-card__meta">
            {preview.domain}
            {preview.provider && ` · ${preview.provider}`}
          </span>
        </div>
      </div>
      {onRemove && (
        <button type="button" className="link-preview-card__remove" onClick={onRemove} aria-label="移除預覽">
          ✕
        </button>
      )}
    </div>
  );
}
