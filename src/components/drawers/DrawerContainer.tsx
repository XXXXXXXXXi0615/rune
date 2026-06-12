import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

interface DrawerContainerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  id: string;
}

export function DrawerContainer({
  isOpen,
  onClose,
  title,
  children,
  id,
}: DrawerContainerProps) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldRender(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = '';
      }, 380); // match CSS transition duration
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  // Drag-to-close
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select,button')) return;
      setDragY(e.touches[0].clientY);
      setDragging(false);
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const dy = e.touches[0].clientY - dragY;
      if (dy > 20) {
        setDragging(true);
      }
    },
    [dragY]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (dragging) {
        const dy = e.changedTouches[0].clientY - dragY;
        if (dy > 80) {
          onClose();
        }
      }
      setDragging(false);
    },
    [dragging, dragY, onClose]
  );

  if (!shouldRender) return null;

  return (
    <>
      <div
        className={`drawer-backdrop ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <div
        id={id}
        className={`bottom-drawer ${isOpen ? 'active' : ''}`}
        aria-hidden={!isOpen}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={
          dragging
            ? {
                transition: 'none',
                transform: `translate(-50%, ${Math.max(
                  0,
                  dragY
                )}px)`,
              }
            : undefined
        }
      >
        <div className="drawer-handle" />
        <div className="drawer-head">
          <span className="drawer-head-title">{title}</span>
          <div className="drawer-close" onClick={onClose}>
            <Icon name="close" size={22} />
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
