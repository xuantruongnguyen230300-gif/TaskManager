import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState } from "react";
import { StatusNoteDialog } from "@/features/task-detail/StatusNoteDialog";
import type { Id, TaskFilter, TaskRow, TaskStatus } from "@/shared/api/types";
import { isOverdue } from "@/shared/lib/date";
import { OPEN_STATUSES, STATUS_ORDER } from "@/shared/lib/status";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/stores/ui";
import { CARD_CLASS, KanbanCardBody } from "./KanbanCard";
import { KanbanColumn } from "./KanbanColumn";
import { useSetTaskStatus } from "./use-set-status";

type NoteStatus = "waiting" | "cancelled";

function isNoteStatus(s: TaskStatus): s is NoteStatus {
  return s === "waiting" || s === "cancelled";
}

function isStatus(v: unknown): v is TaskStatus {
  return typeof v === "string" && (STATUS_ORDER as readonly string[]).includes(v);
}

/** Hạn chót tăng dần, việc không có hạn ở cuối (02 SC-3). */
function byDue(a: TaskRow, b: TaskRow): number {
  if (a.dueDate === b.dueDate) return a.id - b.id;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/**
 * Thẻ vừa thả hiện ngay ở cột mới (không chờ IPC, không nháy về cột cũ) trong lúc chờ hộp lý do
 * hoặc chờ cache cập nhật lạc quan. Tự hết hiệu lực khi `rows` đổi (cache đã có trạng thái mới,
 * hoặc đã hoàn lại khi lỗi).
 */
interface ShownMove {
  base: TaskRow[];
  id: Id;
  status: TaskStatus;
}

export interface KanbanBoardProps {
  projectId: Id;
  /** bộ lọc của truy vấn sinh ra `rows` — để cập nhật lạc quan đúng cache */
  filter: TaskFilter;
  /** việc của dự án (đã lọc theo người phụ trách) */
  rows: TaskRow[];
  /** đang lọc theo người phụ trách (đổi chữ ở cột rỗng) */
  filtered: boolean;
  onOpenTask: (id: Id) => void;
}

/** Kanban 5 cột cố định. Kéo thẻ sang cột khác = `set_task_status` (Đang chờ/Đã huỷ hỏi lý do trước). */
export function KanbanBoard({ projectId, filter, rows, filtered, onOpenTask }: KanbanBoardProps) {
  const { mutate } = useSetTaskStatus(filter);
  const [collapsed, setCollapsed] = useState<Partial<Record<TaskStatus, boolean>>>({
    cancelled: true,
  });
  const [activeId, setActiveId] = useState<Id | null>(null);
  const [shown, setShown] = useState<ShownMove | null>(null);
  const [pending, setPending] = useState<{ id: Id; status: NoteStatus } | null>(null);
  const [noteStatus, setNoteStatus] = useState<NoteStatus>("waiting");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const move = shown !== null && shown.base === rows ? shown : null;
  const columns = useMemo(() => {
    const map = {} as Record<TaskStatus, TaskRow[]>;
    for (const s of STATUS_ORDER) map[s] = [];
    for (const r of rows) {
      if (move && r.id === move.id) map[move.status].push({ ...r, status: move.status });
      else map[r.status].push(r);
    }
    for (const s of STATUS_ORDER) map[s].sort(byDue);
    return map;
  }, [rows, move]);

  const onDragStart = useCallback((e: DragStartEvent) => setActiveId(Number(e.active.id)), []);
  const onDragCancel = useCallback(() => setActiveId(null), []);
  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const to = e.over?.id;
      const id = Number(e.active.id);
      const row = rows.find((r) => r.id === id);
      if (!row || !isStatus(to) || row.status === to) return;
      setShown({ base: rows, id, status: to });
      if (isNoteStatus(to)) {
        setNoteStatus(to);
        setPending({ id, status: to });
        return;
      }
      mutate({ id, status: to, note: null });
    },
    [rows, mutate],
  );

  const onToggle = useCallback((s: TaskStatus) => setCollapsed((c) => ({ ...c, [s]: !c[s] })), []);
  const onAdd = useCallback(
    (status: TaskStatus) => useUiStore.getState().openCreateTask({ projectId, status }),
    [projectId],
  );

  const confirmNote = (note: string) => {
    if (!pending) return;
    mutate({ id: pending.id, status: pending.status, note: note || null });
    setPending(null);
  };
  const cancelNote = () => {
    setPending(null);
    setShown(null);
  };

  const activeRow = activeId === null ? null : (rows.find((r) => r.id === activeId) ?? null);
  const emptyText = filtered ? "Không có việc của người đang lọc" : "Chưa có việc";

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden pb-1.5">
          {STATUS_ORDER.map((s) => (
            <KanbanColumn
              key={s}
              status={s}
              rows={columns[s]}
              collapsed={collapsed[s] === true}
              emptyText={emptyText}
              onToggle={onToggle}
              onOpen={onOpenTask}
              onAdd={OPEN_STATUSES.includes(s) ? onAdd : undefined}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeRow && (
            <div
              className={cn(
                CARD_CLASS,
                "cursor-grabbing shadow-pop",
                isOverdue(activeRow) ? "bg-overdue-row" : "bg-surface",
              )}
            >
              <KanbanCardBody row={activeRow} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <StatusNoteDialog
        open={pending !== null}
        status={noteStatus}
        onConfirm={confirmNote}
        onCancel={cancelNote}
      />
    </>
  );
}
