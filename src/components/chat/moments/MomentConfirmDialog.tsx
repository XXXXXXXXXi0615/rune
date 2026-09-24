import { useEffect, useRef } from 'react';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';

export function MomentConfirmDialog({ title, description, onCancel, onConfirm }: { title: string; description: string; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);
  return <MobileShellOverlay variant="dialog" onClose={onCancel} className="moments-overlay"><section className="moment-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="moment-confirm-title" aria-describedby="moment-confirm-description" data-pet-safe-region="interactive"><h2 id="moment-confirm-title">{title}</h2><p id="moment-confirm-description">{description}</p><div><button ref={cancelRef} type="button" onClick={onCancel}>取消</button><button type="button" className="is-danger" onClick={() => void onConfirm()}>刪除</button></div></section></MobileShellOverlay>;
}
