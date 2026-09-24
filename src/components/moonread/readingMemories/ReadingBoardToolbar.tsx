import type {
  ReadingBoardDecoration,
  ReadingBoardMode,
} from "@/features/moonread/readingMemories/types";
export function ReadingBoardToolbar({
  mode,
  setMode,
  zoom,
  setZoom,
  canUndo,
  canRedo,
  undo,
  redo,
  selected,
  onPatch,
  onReorder,
  onDelete,
  onUpload,
  onAddEntry,
}: {
  mode: ReadingBoardMode;
  setMode(v: ReadingBoardMode): void;
  zoom: number;
  setZoom(v: number): void;
  canUndo: boolean;
  canRedo: boolean;
  undo(): void;
  redo(): void;
  selected?: ReadingBoardDecoration;
  onPatch(p: Partial<ReadingBoardDecoration>): void;
  onReorder(d: "forward" | "backward" | "top" | "bottom"): void;
  onDelete(): void;
  onUpload(): void;
  onAddEntry(): void;
}) {
  return (
    <div className="rm-toolbar" aria-label="畫板工具列">
      <div className="rm-toolbar-group">
        <small>History</small>
        <button onClick={undo} disabled={!canUndo}>
          撤銷
        </button>
        <button onClick={redo} disabled={!canRedo}>
          重做
        </button>
      </div>
      <div className="rm-toolbar-group">
        <small>Insert</small>
        <button onClick={onUpload}>加入圖片</button>
        <button onClick={onAddEntry}>閱讀紀錄</button>
      </div>
      <div className="rm-toolbar-group">
        <small>View</small>
        <button onClick={() => setZoom(Math.max(0.35, zoom - 0.1))}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}>＋</button>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as ReadingBoardMode)}
          aria-label="顯示模式"
        >
          <option value="edit">編輯</option>
          <option value="preview">預覽</option>
          <option value="reading">閱讀</option>
        </select>
      </div>
      {selected && (
        <>
          <div className="rm-toolbar-group rm-toolbar-selection">
            <small>Transform</small>
            <button onClick={() => onPatch({ flipX: !selected.flipX })}>
              水平翻轉
            </button>
            <button onClick={() => onPatch({ flipY: !selected.flipY })}>
              垂直翻轉
            </button>
            <button onClick={() => onReorder("backward")}>下移</button>
            <button onClick={() => onReorder("forward")}>上移</button>
            <button onClick={() => onPatch({ locked: !selected.locked })}>
              {selected.locked ? "解鎖" : "鎖定"}
            </button>
          </div>
          <div className="rm-toolbar-group rm-toolbar-danger">
            <small>Danger</small>
            <button className="danger" onClick={onDelete}>
              刪除
            </button>
          </div>
        </>
      )}
    </div>
  );
}
