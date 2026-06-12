import { useState, useEffect } from 'react';
import { useToastStore } from '@/store/useToastStore';

export function Toast() {
  const message = useToastStore((s) => s.message);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
    setVisible(false);
    return undefined;
  }, [message]);

  if (!visible || !message) return null;

  return <div className="toast visible">{message}</div>;
}
