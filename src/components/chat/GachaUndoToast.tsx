import { useState, useEffect, useCallback } from 'react';

interface Props {
  message: string;
  onUndo: () => void;
  duration?: number;
  onDone?: () => void;
}

export function GachaUndoToast({ message, onUndo, duration = 6000, onDone }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  const handleUndo = useCallback(() => {
    onUndo();
    setVisible(false);
    onDone?.();
  }, [onUndo, onDone]);

  if (!visible) return null;

  return (
    <div className="gc-undo-toast" role="status" aria-live="polite">
      <span className="gc-undo-toast-msg">{message}</span>
      <button className="gc-undo-toast-btn" onClick={handleUndo} aria-label="復原">
        復原
      </button>
    </div>
  );
}
