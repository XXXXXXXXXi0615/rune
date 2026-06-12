import { useDrawerStore } from '@/store/useDrawerStore';
import { DrawerContainer } from '@/components/drawers/DrawerContainer';
import { useAppStore } from '@/store/useAppStore';
import { AttachmentDrawer } from '@/components/chat/AttachmentDrawer';
import { ExportDrawer } from '@/components/memory/ExportDrawer';
import { TodoForm } from '@/components/calendar/TodoForm';
import { CountdownForm } from '@/components/calendar/CountdownForm';
import { WaterSettings } from '@/components/calendar/WaterSettings';

export function AllDrawers() {
  const closeDrawer = useDrawerStore((s) => s.closeDrawer);
  const activeDrawer = useDrawerStore((s) => s.activeDrawer);
  const sendImage = useAppStore((s) => s.sendImage);
  const sendFile = useAppStore((s) => s.sendFile);
  const memoryEntries = useAppStore((s) => s.memoryEntries);

  const handlePhoto = (assetId: string, fileType: string, fileName: string, fileSize: number) => {
    sendImage(assetId, fileType, { fileName, fileSize });
    closeDrawer();
  };

  const handleFile = (assetId: string, fileName: string, fileSize: number, fileType: string) => {
    sendFile(assetId, fileName, fileSize, fileType);
    closeDrawer();
  };

  return (
    <>
      <DrawerContainer
        isOpen={activeDrawer === 'calendar-create'}
        onClose={closeDrawer}
        title="新增到日曆"
        id="calendar-create-drawer"
      >
        <div className="drawer-actions">
          <p style={{ textAlign: 'center', color: 'var(--text-2)', padding: 20 }}>
            日曆快速新增（待實作）
          </p>
        </div>
      </DrawerContainer>

      <DrawerContainer
        isOpen={activeDrawer === 'todo'}
        onClose={closeDrawer}
        title="新增待辦"
        id="todo-drawer"
      >
        <TodoForm onDone={closeDrawer} />
      </DrawerContainer>

      <DrawerContainer
        isOpen={activeDrawer === 'countdown'}
        onClose={closeDrawer}
        title="新增倒計時"
        id="countdown-drawer"
      >
        <CountdownForm onDone={closeDrawer} />
      </DrawerContainer>

      <DrawerContainer
        isOpen={activeDrawer === 'event'}
        onClose={closeDrawer}
        title="新增事件"
        id="event-drawer"
      >
        <p style={{ textAlign: 'center', color: 'var(--text-2)', padding: 20 }}>
          事件表單（待實作）
        </p>
      </DrawerContainer>

      <DrawerContainer
        isOpen={activeDrawer === 'water'}
        onClose={closeDrawer}
        title="飲水設定"
        id="water-drawer"
      >
        <WaterSettings onDone={closeDrawer} />
      </DrawerContainer>

      <DrawerContainer
        isOpen={activeDrawer === 'icon-editor'}
        onClose={closeDrawer}
        title="桌面圖標編輯器"
        id="icon-editor-drawer"
      >
        <p style={{ textAlign: 'center', color: 'var(--text-2)', padding: 20 }}>
          圖標編輯器（待實作）
        </p>
      </DrawerContainer>

      <DrawerContainer
        isOpen={activeDrawer === 'qj-export'}
        onClose={closeDrawer}
        title="匯出格式"
        id="qj-export-drawer"
      >
        <ExportDrawer entries={memoryEntries} onClose={closeDrawer} />
      </DrawerContainer>

      <DrawerContainer
        isOpen={activeDrawer === 'attachment'}
        onClose={closeDrawer}
        title="附件"
        id="attachment-drawer"
      >
        <div className="drawer-actions">
          <AttachmentDrawer onPhoto={handlePhoto} onFile={handleFile} />
        </div>
      </DrawerContainer>
    </>
  );
}
