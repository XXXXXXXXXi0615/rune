import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMoonReadStore } from "@/features/moonread/useMoonReadStore";
import { saveReadingMemoryImage } from "@/features/moonread/readingMemories/assets";
import { useReadingMemoryStore } from "@/features/moonread/readingMemories/useReadingMemoryStore";
import type {
  ReadingBoardDecoration,
  ReadingBoardMode,
  ReadingTimelineEntry,
} from "@/features/moonread/readingMemories/types";
import { ReadingTimelineCanvas } from "@/components/moonread/readingMemories/ReadingTimelineCanvas";
import { ReadingBoardToolbar } from "@/components/moonread/readingMemories/ReadingBoardToolbar";
import { ReadingBoardInspector } from "@/components/moonread/readingMemories/ReadingBoardInspector";
import "@/styles/reading-memories.css";

async function readImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("無法讀取圖片尺寸"));
  });
  const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
  URL.revokeObjectURL(objectUrl);
  return dimensions;
}

export function ReadingMemoryBoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const store = useReadingMemoryStore();
  const allBooks = useMoonReadStore((s) => s.books);
  const books = useMemo(
    () => allBooks.filter((b) => b.libraryState === "active"),
    [allBooks],
  );
  const board = store.boards.find((b) => b.id === boardId);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [autoScale, setAutoScale] = useState(0.65);
  const [zoom, setZoom] = useState(1);
  const scale = autoScale * zoom;
  const [mode, setMode] = useState<ReadingBoardMode>("edit");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<
    Record<string, ReadingBoardDecoration>
  >({});
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setAutoScale(
        Math.min(
          1,
          (entry.contentRect.width - 32) / 750,
          (entry.contentRect.height - 32) / 1334,
        ),
      ),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!boardId && store.boards.length)
      navigate(`/moonread/memories/${store.boards[0].id}`, { replace: true });
  }, [boardId, store.boards, navigate]);
  const selected = board?.imageLayers.find((i) => i.id === selectedId);
  const editingEntry = board?.entries.find((e) => e.id === editingEntryId);
  if (!board)
    return (
      <div className="rm-page rm-empty">
        <button onClick={() => navigate("/moonread/memories")}>
          返回共讀足跡
        </button>
        <h1>找不到這張共讀足跡</h1>
      </div>
    );
  const commit = (item: ReadingBoardDecoration) => {
    setDraftItems((s) => {
      const n = { ...s };
      delete n[item.id];
      return n;
    });
    store.updateDecoration(board.id, item.id, item, true);
  };
  const patchSelected = (patch: Partial<ReadingBoardDecoration>) =>
    selected && store.updateDecoration(board.id, selected.id, patch, true);
  const removeSelected = () => {
    if (!selected) return;
    store.removeDecoration(board.id, selected.id);
    setSelectedId(null);
  };
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadError("");
      const dimensions = await readImageDimensions(file);
      const ratio = dimensions.width / dimensions.height;
      const width = ratio >= 1 ? 280 : Math.max(120, Math.round(280 * ratio));
      const height = ratio >= 1 ? Math.max(120, Math.round(280 / ratio)) : 280;
      const assetId = await saveReadingMemoryImage(file);
      const id = store.addDecoration(board.id, {
        type: "image",
        assetId,
        x: board.designWidth / 2 - width / 2,
        y: 930,
        width,
        height,
        rotation: 0,
        opacity: 1,
        locked: false,
        aspectMode: "contain",
      });
      setSelectedId(id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "圖片保存失敗");
    } finally {
      e.target.value = "";
    }
  };
  return (
    <div
      className={`rm-page is-${mode}`}
      data-testid="reading-memory-board-page"
    >
      <header className="rm-page-header">
        <div>
          <button onClick={() => navigate("/moonread/memories")}>
            ‹ 共讀足跡
          </button>
          <h1>{board.title}</h1>
          <p>Editorial Timeline Board</p>
        </div>
        {mode === "preview" ? (
          <button onClick={() => setMode("edit")}>退出預覽</button>
        ) : (
          <button onClick={() => setEntryOpen(true)}>＋ 閱讀紀錄</button>
        )}
      </header>
      <ReadingBoardToolbar
        mode={mode}
        setMode={setMode}
        zoom={zoom}
        setZoom={setZoom}
        canUndo={store.past.length > 0}
        canRedo={store.future.length > 0}
        undo={store.undo}
        redo={store.redo}
        selected={selected}
        onPatch={patchSelected}
        onReorder={(d) =>
          selected && store.reorderDecoration(board.id, selected.id, d)
        }
        onDelete={removeSelected}
        onUpload={() => fileRef.current?.click()}
        onAddEntry={() => setEntryOpen(true)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="sr-only"
        onChange={upload}
      />
      {uploadError && <div className="rm-upload-error" role="alert">{uploadError}</div>}
      <div className="rm-editor-layout">
        <aside className="rm-record-panel">
          <h2>閱讀時間線</h2>
          <p>固定 750 × 1334 reference coordinate</p>
          <button onClick={() => setEntryOpen(true)}>新增閱讀紀錄</button>
          <label>
            主標題
            <input
              value={board.title}
              onChange={(e) =>
                store.updateBoard(board.id, { title: e.target.value }, false)
              }
              onBlur={(e) =>
                store.updateBoard(board.id, { title: e.target.value }, true)
              }
            />
          </label>
          <label>
            副標題
            <input
              value={board.subtitle || ""}
              onChange={(e) =>
                store.updateBoard(board.id, { subtitle: e.target.value }, false)
              }
              onBlur={(e) =>
                store.updateBoard(board.id, { subtitle: e.target.value }, true)
              }
            />
          </label>
        </aside>
        <div className="rm-workspace" ref={workspaceRef}>
          <div
            className="rm-canvas-scale-wrap"
            style={{
              width: board.designWidth * scale,
              height: board.designHeight * scale,
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <ReadingTimelineCanvas
                board={board}
                scale={scale}
                mode={mode}
                selectedId={selectedId}
                draftItems={draftItems}
                onSelect={setSelectedId}
                onAddEntry={() => setEntryOpen(true)}
                onEditEntry={(id) => {
                  setEditingEntryId(id);
                  setEntryOpen(true);
                }}
                onDraft={(item) =>
                  setDraftItems((s) => ({ ...s, [item.id]: item }))
                }
                onCommit={commit}
                guides={guides}
                onGuides={setGuides}
                onLongPress={(id) => {
                  setSelectedId(id);
                  setPropertiesOpen(true);
                }}
              />
            </div>
          </div>
        </div>
        <ReadingBoardInspector items={board.imageLayers} selected={selected} selectedId={selectedId} mobileOpen={propertiesOpen} onClose={()=>setPropertiesOpen(false)} onSelect={setSelectedId} onPatch={patchSelected} onReorder={(id,d)=>store.reorderDecoration(board.id,id,d)} onDelete={removeSelected}/>
      </div>
      <div className="rm-mobile-bar">
        <button onClick={() => fileRef.current?.click()}>圖片</button>
        <button onClick={() => setEntryOpen(true)}>紀錄</button>
        <button onClick={store.undo} disabled={!store.past.length}>
          撤銷
        </button>
        <button onClick={store.redo} disabled={!store.future.length}>
          重做
        </button>
        <button onClick={() => setPropertiesOpen(true)} disabled={!selected}>
          屬性
        </button>
      </div>
      {entryOpen && (
        <EntryDialog
          books={books}
          initial={editingEntry}
          onClose={() => {
            setEntryOpen(false);
            setEditingEntryId(null);
          }}
          onSave={(entry) => {
            if (editingEntryId)
              store.updateEntry(board.id, editingEntryId, entry);
            else store.addEntry(board.id, entry);
            setEntryOpen(false);
            setEditingEntryId(null);
          }}
          onDelete={
            editingEntryId
              ? () => {
                  store.removeEntry(board.id, editingEntryId);
                  setEntryOpen(false);
                  setEditingEntryId(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function EntryDialog({
  books,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  books: ReturnType<typeof useMoonReadStore.getState>["books"];
  initial?: ReadingTimelineEntry;
  onClose(): void;
  onSave(entry: Omit<ReadingTimelineEntry, "id" | "order">): void;
  onDelete?: () => void;
}) {
  const [bookId, setBookId] = useState(initial?.bookId || books[0]?.id || "");
  const book = books.find((b) => b.id === bookId);
  const [title, setTitle] = useState(initial?.title || book?.title || "");
  const [author, setAuthor] = useState(initial?.author || book?.author || "");
  const [chapterTitle, setChapterTitle] = useState(initial?.chapterTitle || "");
  const [date, setDate] = useState(
    new Date(initial?.date || Date.now()).toISOString().slice(0, 10),
  );
  const [note, setNote] = useState(initial?.excerpt || "");
  const [mood, setMood] = useState(initial?.moodTag || "平靜");
  return (
    <div className="rm-dialog-backdrop">
      <form
        className="rm-entry-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            bookId: book?.id,
            date: new Date(`${date}T12:00:00`).getTime(),
            title: title.trim() || book?.title || "未命名閱讀",
            author: author.trim() || book?.author,
            excerpt: note,
            moodTag: mood,
            coverAssetId: book?.coverAssetId || initial?.coverAssetId,
            chapterTitle: chapterTitle.trim() || undefined,
          });
        }}
      >
        <header>
          <h2>{initial ? "編輯閱讀紀錄" : "新增閱讀紀錄"}</h2>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <label>
          從書架選書
          <select
            aria-label="從書架選書"
            value={bookId}
            onChange={(e) => {
              const nextId = e.target.value;
              const nextBook = books.find((item) => item.id === nextId);
              setBookId(nextId);
              if (nextBook) {
                setTitle(nextBook.title);
                setAuthor(nextBook.author || "");
              }
            }}
          >
            <option value="">手動建立閱讀紀錄</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title} · {book.author}
              </option>
            ))}
          </select>
        </label>
        <label>
          書名
          <input aria-label="閱讀書名" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          作者
          <input aria-label="閱讀作者" value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <label>
          章節（選填）
          <input aria-label="閱讀章節" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="漫畫章節或閱讀段落" />
        </label>
        <label>
          閱讀日期
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          短評
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={180}
          />
        </label>
        <label>
          心情標籤
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            <option>平靜</option>
            <option>被照亮</option>
            <option>沉浸</option>
            <option>心潮起伏</option>
            <option>想再讀一次</option>
          </select>
        </label>
        <footer>
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete}>
              刪除紀錄
            </button>
          )}
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="submit">儲存紀錄</button>
        </footer>
      </form>
    </div>
  );
}
