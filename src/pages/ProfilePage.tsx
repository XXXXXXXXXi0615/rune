import { useRef, useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { BackButton } from '@/components/layout/BackButton';
import { Card } from '@/components/ui/Card';
import { useAppStore } from '@/store/useAppStore';
import { saveAsset, getAsset } from '@/store/assets';

function useAssetUrl(assetId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;

    getAsset(assetId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  return url;
}

export function ProfilePage() {
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [status, setStatus] = useState(profile.status);
  const [bio, setBio] = useState(profile.bio);

  const avatarUrl = useAssetUrl(profile.avatarAssetId);
  const coverUrl = useAssetUrl(profile.coverAssetId);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const assetId = await saveAsset(file, file.type);
      updateProfile({ avatarAssetId: assetId });
    } catch { /* ignore */ }
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const assetId = await saveAsset(file, file.type);
      updateProfile({ coverAssetId: assetId });
    } catch { /* ignore */ }
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleSave = () => {
    updateProfile({ displayName: displayName.trim(), status: status.trim(), bio: bio.trim() });
    updateSettings({ userName: displayName.trim() });
  };

  const hasChanges =
    displayName !== profile.displayName ||
    status !== profile.status ||
    bio !== profile.bio;

  return (
    <section id="profile-view" className="view">
      <BackButton to="/settings" />
      <Header eyebrow="個人化" title="工作室" />

      {/* Hidden file inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={handleAvatarUpload}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={handleCoverUpload}
      />

      {/* Cover */}
      <Card>
        <div
          className="profile-cover"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          onClick={() => coverInputRef.current?.click()}
        >
          <div className="profile-cover-overlay">
            <span>{coverUrl ? '更換封面' : '點擊上傳封面'}</span>
          </div>
        </div>

        {/* Avatar */}
        <div className="profile-avatar-row">
          <div
            className="profile-avatar-img"
            style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
            onClick={() => avatarInputRef.current?.click()}
          />
          <div className="profile-avatar-hint">
            點擊頭像更換<br />
            支援 JPG / PNG / WebP
          </div>
        </div>
      </Card>

      {/* Profile Form */}
      <Card>
        <div className="settings-section">
          <div className="settings-section-title">個人資料</div>

          <div className="profile-field">
            <label>顯示名稱</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="你的名字"
            />
          </div>

          <div className="profile-field">
            <label>狀態</label>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Online"
            />
          </div>

          <div className="profile-field">
            <label>簡介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="寫一句關於你的話..."
            />
          </div>

          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={handleSave}
            disabled={!hasChanges || !displayName.trim()}
          >
            儲存變更
          </button>
        </div>
      </Card>
    </section>
  );
}
