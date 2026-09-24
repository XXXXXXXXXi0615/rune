import { useEffect, useState } from 'react';
import { useReleaseNoticeStore } from '@/features/tideclock/useReleaseNoticeStore';

export function ReleaseHistoryPanel() {
  const notices = useReleaseNoticeStore((state) => state.notices);
  const ensureNotices = useReleaseNoticeStore((state) => state.ensureNotices);
  const markRead = useReleaseNoticeStore((state) => state.markRead);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { ensureNotices(); }, [ensureNotices]);

  return <section className="settings-info-block settings-release-history" data-testid="release-history">
    <strong>版本與迭代記錄</strong>
    <p>月潮的版本摘要與既有 Iteration Notice 都留在這裡，不佔用每日簽到。</p>
    <div className="settings-module-list">
      {[...notices].sort((a, b) => b.publishedAt - a.publishedAt).map((notice) => {
        const open = expanded === notice.id;
        return <article key={notice.id} className="settings-standard-row settings-release-row">
          <button type="button" className="settings-release-toggle" aria-expanded={open} onClick={() => { markRead(notice.version); setExpanded(open ? null : notice.id); }}>
            <span className="settings-standard-copy"><span>v{notice.version}</span><small>{new Date(notice.publishedAt).toLocaleDateString('zh-TW')}</small></span><span aria-hidden="true">{open ? '−' : '+'}</span>
          </button>
          {open && <div className="settings-release-body">{([
            ['新增', notice.added], ['改進', notice.improved], ['修復', notice.fixed], ['已知問題', notice.knownIssues],
          ] as const).filter(([,items]) => items.length).map(([label,items]) => <div key={label}><b>{label}</b><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}</div>}
        </article>;
      })}
    </div>
  </section>;
}
