import { useEffect, useState } from "react";
import type { ReadingBoardDecoration } from "@/features/moonread/readingMemories/types";
import { ReadingBoardLayerPanel } from "./ReadingBoardLayerPanel";
export function ReadingBoardInspector({
  items,
  selected,
  selectedId,
  mobileOpen,
  onClose,
  onSelect,
  onPatch,
  onReorder,
  onDelete,
}: {
  items: ReadingBoardDecoration[];
  selected?: ReadingBoardDecoration;
  selectedId: string | null;
  mobileOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onPatch: (patch: Partial<ReadingBoardDecoration>) => void;
  onReorder: (id: string, d: "forward" | "backward" | "top" | "bottom") => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<"layers" | "properties">("layers");
  useEffect(() => {
    if (selectedId && (mobileOpen || tab === "layers")) setTab("properties");
  }, [selectedId, mobileOpen]);
  return (
    <aside className={`rm-inspector${mobileOpen ? " is-open" : ""}`}>
      <button className="rm-properties-close" onClick={onClose}>
        完成
      </button>
      <div className="rm-inspector-tabs">
        <button
          className={tab === "layers" ? "active" : ""}
          onClick={() => setTab("layers")}
        >
          圖層
        </button>
        <button
          className={tab === "properties" ? "active" : ""}
          onClick={() => setTab("properties")}
          disabled={!selected}
        >
          屬性
        </button>
      </div>
      {tab === "layers" ? (
        <ReadingBoardLayerPanel
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          onReorder={(id, d) => onReorder(id, d)}
        />
      ) : selected ? (
        <div className="rm-properties">
          <h2>圖片屬性</h2>
          <label>
            寬度
            <input
              aria-label="圖片寬度"
              type="number"
              min="32"
              value={Math.round(selected.width)}
              onChange={(e) => {
                const width = Math.max(32, Number(e.target.value));
                onPatch(
                  selected.aspectMode === "free"
                    ? { width }
                    : {
                        width,
                        height: width / (selected.width / selected.height),
                      },
                );
              }}
            />
          </label>
          <label>
            高度
            <input
              aria-label="圖片高度"
              type="number"
              min="32"
              value={Math.round(selected.height)}
              onChange={(e) =>
                onPatch({ height: Math.max(32, Number(e.target.value)) })
              }
            />
          </label>
          <label className="rm-check">
            <input
              type="checkbox"
              checked={selected.aspectMode === "contain"}
              onChange={(e) => onPatch({ aspectMode: e.target.checked ? "contain" : "free" })}
            />
            <span>鎖定比例</span>
          </label>
          <label>
            透明度
            <input
              aria-label="圖片透明度"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={selected.opacity}
              onChange={(e) => onPatch({ opacity: Number(e.target.value) })}
            />
          </label>
          <label>
            旋轉
            <input
              aria-label="圖片旋轉角度"
              type="number"
              value={Math.round(selected.rotation)}
              onChange={(e) => onPatch({ rotation: Number(e.target.value) })}
            />
          </label>
          <div className="rm-inspector-actions">
            <button onClick={() => onPatch({ flipX: !selected.flipX })}>
              水平翻轉
            </button>
            <button onClick={() => onPatch({ flipY: !selected.flipY })}>
              垂直翻轉
            </button>
              <button aria-label="Inspector toggle lock" onClick={() => onPatch({ locked: !selected.locked })}>
              {selected.locked ? "解鎖" : "鎖定"}
            </button>
              <button aria-label="Inspector move forward" onClick={() => onReorder(selected.id, "forward")}>
              上移
            </button>
              <button aria-label="Inspector move backward" onClick={() => onReorder(selected.id, "backward")}>
              下移
            </button>
            <button onClick={() => onReorder(selected.id, "top")}>置頂</button>
            <button onClick={() => onReorder(selected.id, "bottom")}>
              置底
            </button>
            <button className="danger" onClick={onDelete}>
              刪除
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
