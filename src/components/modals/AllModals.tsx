import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModalStore } from '@/store/useModalStore';
import { ModalOverlay } from '@/components/modals/ModalOverlay';
import { useAppStore } from '@/store/useAppStore';
import { MoonIcon, TodoIcon, WaterIcon } from '@/components/icons/LunartideIcons';
import { t } from '@/i18n';
import { toLocalDateString } from '@/utils/date';

function DangerZoneModal({ onClose }: { onClose: () => void }) {
  const clearAllData = useAppStore((s) => s.clearAllData);
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    await clearAllData();
  };

  return (
    <div
      className="modal-sheet"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-handle" />
      <div className="modal-body">
        <div className="danger-body">
          <p>{t('danger.title')}</p>
          <p className="danger-warn">{t('danger.warn')}</p>
          <div className="danger-actions">
            <button className="btn-ghost" onClick={onClose} disabled={clearing}>
              {t('danger.cancel')}
            </button>
            <button
              className="btn-primary"
              onClick={handleClear}
              disabled={clearing}
              style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              {clearing ? t('danger.clearing') : t('danger.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MenuItemData {
  icon: ReactNode;
  iconClass: string;
  label: string;
  hint: string;
  action: () => void;
}

function MenuModalContent({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const openSheet = useModalStore((s) => s.openSheet);
  const addWater = useAppStore((s) => s.addWater);
  const resetWaterIfNeeded = useAppStore((s) => s.resetWaterIfNeeded);

  const items: MenuItemData[] = [
    {
      icon: <MoonIcon size={18} />,
      iconClass: 'mood',
      label: t('menu.mood'),
      hint: t('menu.moodHint'),
      action: () => { onClose(); openSheet('mood'); },
    },
    {
      icon: <TodoIcon size={18} />,
      iconClass: 'todo',
      label: t('menu.todo'),
      hint: t('menu.todoHint'),
      action: () => {
        onClose();
        const today = toLocalDateString();
        navigate(`/calendar?action=new&date=${today}`);
      },
    },
    {
      icon: <WaterIcon size={18} />,
      iconClass: 'water',
      label: t('menu.water'),
      hint: t('menu.waterHint'),
      action: () => {
        onClose();
        resetWaterIfNeeded();
        addWater(250);
      },
    },
  ];

  return (
    <div
      className="menu-modal-overlay active"
      onClick={onClose}
      style={{ display: 'flex' }}
    >
      <div
        className="menu-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-modal-head">
          <span className="menu-modal-title">{t('menu.title')}</span>
          <div className="menu-modal-close" onClick={onClose}>
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </div>
        <div className="menu-modal-body">
          {items.map((item, i) => (
            <div key={item.label}>
              {i > 0 && <div className="menu-divider" />}
              <button className="menu-item" onClick={item.action}>
                <div className={`menu-item-icon ${item.iconClass}`}>
                  {item.icon}
                </div>
                <div className="menu-item-text">
                  <span className="menu-item-label">{item.label}</span>
                  <span className="menu-item-hint">{item.hint}</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AllModals() {
  const closeModal = useModalStore((s) => s.closeModal);
  const activeModal = useModalStore((s) => s.activeModal);

  return (
    <>
      {/* Message Action Sheet */}
      <ModalOverlay
        isOpen={activeModal === 'message-action-sheet'}
        onClose={closeModal}
      >
        <div
          className="modal-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-handle" />
          <div className="modal-body">
            <p style={{ textAlign: 'center', color: 'var(--text-2)', padding: 20 }}>
              訊息操作（待實作）
            </p>
          </div>
        </div>
      </ModalOverlay>

      {/* Menu Modal */}
      <ModalOverlay
        isOpen={activeModal === 'menu-modal'}
        onClose={closeModal}
      >
        <MenuModalContent onClose={closeModal} />
      </ModalOverlay>

      {/* Icon Cropper */}
      <ModalOverlay
        isOpen={activeModal === 'icon-cropper'}
        onClose={closeModal}
      >
        <div
          className="modal-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-handle" />
          <div className="modal-body">
            <p style={{ textAlign: 'center', color: 'var(--text-2)', padding: 20 }}>
              圖標裁剪器（待實作）
            </p>
          </div>
        </div>
      </ModalOverlay>

      {/* Danger Zone */}
      <ModalOverlay
        isOpen={activeModal === 'danger-zone'}
        onClose={closeModal}
      >
        <DangerZoneModal onClose={closeModal} />
      </ModalOverlay>
    </>
  );
}
