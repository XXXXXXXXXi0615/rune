import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CURRENT_RELEASE, UPDATE_SEEN_KEY } from '@/config/updateNotes';

function getSeenVersion(): string | null {
  try {
    return localStorage.getItem(UPDATE_SEEN_KEY);
  } catch {
    return null;
  }
}

function markSeen(version: string) {
  try {
    localStorage.setItem(UPDATE_SEEN_KEY, version);
  } catch {
    // localStorage may be unavailable.
  }
}

export function UpdateCenter() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = getSeenVersion();
    if (seen !== CURRENT_RELEASE.version) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    markSeen(CURRENT_RELEASE.version);
    setVisible(false);
  };

  if (!visible) return null;

  return createPortal(
    <>
      <div
        className="update-center-backdrop"
        onClick={dismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0, 0, 0, 0.28)',
          backdropFilter: 'blur(2px)',
        }}
      />
      <div
        className="update-center-panel"
        role="dialog"
        aria-labelledby="update-center-title"
        aria-modal="true"
        style={{
          position: 'fixed',
          zIndex: 10001,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, calc(100vw - 32px))',
          maxHeight: 'min(80dvh, 560px)',
          overflow: 'auto',
          background: 'var(--surface-3)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.16)',
          padding: '20px 20px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Update Center
            </div>
            <h2 id="update-center-title" style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
              {CURRENT_RELEASE.title}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              v{CURRENT_RELEASE.version}
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="關閉更新公告"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-3)',
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)' }}>
          {CURRENT_RELEASE.summary}
        </p>

        <ul style={{ margin: '0 0 18px', paddingLeft: 18, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
          {CURRENT_RELEASE.items.map((item) => (
            <li key={item} style={{ marginBottom: 6 }}>{item}</li>
          ))}
        </ul>

        <button
          type="button"
          onClick={dismiss}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 10,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'inherit',
          }}
        >
          知道了
        </button>
      </div>
    </>,
    document.body,
  );
}
