import { useCallback, useEffect, useRef, useState } from "react";
import { useAssetBlobUrl } from "@/hooks/useAssetBlobUrl";
import {
  canMoveDecoration,
  resizeWithAspect,
  screenDeltaToBoard,
  snapDecoration,
} from "@/features/moonread/readingMemories/geometry";
import type { ReadingBoardDecoration } from "@/features/moonread/readingMemories/types";

type Gesture = {
  type: "move" | "resize" | "rotate";
  startX: number;
  startY: number;
  start: ReadingBoardDecoration;
};
export function TransformableReadingImage({
  item,
  scale,
  selected,
  editable,
  onSelect,
  onDraft,
  onCommit,
  onGuides,
  onLongPress,
}: {
  item: ReadingBoardDecoration;
  scale: number;
  selected: boolean;
  editable: boolean;
  onSelect(): void;
  onDraft(item: ReadingBoardDecoration): void;
  onCommit(item: ReadingBoardDecoration): void;
  onGuides(guides: { x?: number; y?: number }): void;
  onLongPress(): void;
}) {
  const url = useAssetBlobUrl(item.assetId);
  const [draft, setDraft] = useState(item);
  const draftRef = useRef(item);
  const gesture = useRef<Gesture | null>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{
    distance: number;
    angle: number;
    item: ReadingBoardDecoration;
  } | null>(null);
  const longTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!gesture.current) {
      setDraft(item);
      draftRef.current = item;
    }
  }, [item]);
  const applyDraft = useCallback(
    (next: ReadingBoardDecoration) => {
      draftRef.current = next;
      setDraft(next);
      onDraft(next);
    },
    [onDraft],
  );
  const begin = (event: React.PointerEvent, type: Gesture["type"]) => {
    if (!editable) return;
    onSelect();
    if (!canMoveDecoration(item)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (activePointers.current.size === 2) {
      const [a, b] = [...activePointers.current.values()];
      pinchStart.current = {
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        item: draft,
      };
    } else
      gesture.current = {
        type,
        startX: event.clientX,
        startY: event.clientY,
        start: draft,
      };
    longTimer.current = window.setTimeout(onLongPress, 520);
  };
  const move = (event: React.PointerEvent) => {
    if (!editable || item.locked) return;
    const point = activePointers.current.get(event.pointerId);
    if (point)
      activePointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    if (Math.hypot(event.movementX, event.movementY) > 3 && longTimer.current)
      clearTimeout(longTimer.current);
    if (activePointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...activePointers.current.values()];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const factor = distance / Math.max(1, pinchStart.current.distance);
      const next = {
        ...pinchStart.current.item,
        width: Math.max(32, pinchStart.current.item.width * factor),
        height: Math.max(32, pinchStart.current.item.height * factor),
        rotation:
          pinchStart.current.item.rotation +
          ((Math.atan2(b.y - a.y, b.x - a.x) - pinchStart.current.angle) *
            180) /
            Math.PI,
      };
      applyDraft(next);
      return;
    }
    const g = gesture.current;
    if (!g) return;
    const dx = screenDeltaToBoard(event.clientX - g.startX, scale);
    const dy = screenDeltaToBoard(event.clientY - g.startY, scale);
    let next = g.start;
    if (g.type === "move") {
      const snapped = snapDecoration(
        { ...g.start, x: g.start.x + dx, y: g.start.y + dy },
        750,
        1334,
        8 / scale,
      );
      next = snapped.item;
      onGuides({ x: snapped.guideX, y: snapped.guideY });
    } else if (g.type === "resize") {
      const size = resizeWithAspect(
        g.start.width,
        g.start.height,
        dx,
        dy,
        draft.aspectMode === "contain",
      );
      next = { ...g.start, ...size };
    } else {
      const cx = g.start.x + g.start.width / 2,
        cy = g.start.y + g.start.height / 2;
      next = {
        ...g.start,
        rotation:
          (Math.atan2(event.clientY / scale - cy, event.clientX / scale - cx) *
            180) /
            Math.PI +
          90,
      };
    }
    applyDraft(next);
  };
  const finish = (event: React.PointerEvent) => {
    if (longTimer.current) clearTimeout(longTimer.current);
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size === 0) {
      if (gesture.current || pinchStart.current) onCommit(draftRef.current);
      gesture.current = null;
      pinchStart.current = null;
      onGuides({});
    }
  };
  const cancel = () => {
    if (longTimer.current) clearTimeout(longTimer.current);
    activePointers.current.clear();
    gesture.current = null;
    pinchStart.current = null;
    setDraft(item);
    onDraft(item);
    onGuides({});
  };
  useEffect(() => {
    if (!selected) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, item]);
  return (
    <div
      data-decoration-id={item.id}
      className={`rm-decoration${selected ? " is-selected" : ""}${item.locked ? " is-locked" : ""}`}
      style={{
        left: draft.x,
        top: draft.y,
        width: draft.width,
        height: draft.height,
        zIndex: draft.zIndex,
        opacity: draft.opacity,
        transform: `rotate(${draft.rotation}deg) scaleX(${draft.flipX ? -1 : 1}) scaleY(${draft.flipY ? -1 : 1})`,
      }}
      onPointerDown={(e) => begin(e, "move")}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={cancel}
    >
      {url && <img className={draft.aspectMode === "contain" ? "is-contain" : "is-free"} src={url} alt="閱讀足跡裝飾" draggable={false} />}{" "}
      {selected && editable && !draft.locked && (
        <>
          <button
            className="rm-transform-handle rm-transform-handle--resize"
            aria-label="縮放圖片"
            onPointerDown={(e) => {
              e.stopPropagation();
              begin(e, "resize");
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              move(e);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              finish(e);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              cancel();
            }}
          />
          <button
            className="rm-transform-handle rm-transform-handle--rotate"
            aria-label="旋轉圖片"
            onPointerDown={(e) => {
              e.stopPropagation();
              begin(e, "rotate");
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              move(e);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              finish(e);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              cancel();
            }}
          >
            ↻
          </button>
        </>
      )}
    </div>
  );
}
