import { useRef } from 'react';
import { saveAsset } from '@/store/assets';
import { useToastStore } from '@/store/useToastStore';

interface AttachmentDrawerProps {
  onPhoto: (assetId: string, fileType: string, fileName: string, fileSize: number) => void;
  onFile: (assetId: string, fileName: string, fileSize: number, fileType: string) => void;
}

export function AttachmentDrawer({ onPhoto, onFile }: AttachmentDrawerProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = useToastStore((s) => s.showToast);

  const handlePhoto = () => photoInputRef.current?.click();
  const handleFile = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const assetId = await saveAsset(file, file.type || 'image/png');
      onPhoto(assetId, file.type || 'image/png', file.name, file.size);
    } catch {
      showToast('圖片儲存失敗');
    }
    e.target.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const assetId = await saveAsset(file, file.type || 'application/octet-stream');
      onFile(assetId, file.name, file.size, file.type || 'application/octet-stream');
    } catch {
      showToast('檔案儲存失敗');
    }
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={handlePhotoChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="attach-grid">
        <button className="attach-option" onClick={handlePhoto}>
          <div className="attach-option-icon photos">
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <span className="attach-option-label">Photos</span>
        </button>

        <button className="attach-option" onClick={handleFile}>
          <div className="attach-option-icon files">
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <span className="attach-option-label">Files</span>
        </button>
      </div>
    </>
  );
}
