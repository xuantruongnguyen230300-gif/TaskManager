import { useDroppable } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { memo } from "react";
import type { Id, TaskRow, TaskStatus } from "@/shared/api/types";
import { STATUS_META } from "@/shared/lib/status";
import { cn } from "@/shared/lib/utils";
import { StatusChip, StatusIcon } from "@/shared/ui/status-chip";
import { KanbanCard } from "./KanbanCard";

const LANE = "rounded-card bg-lane shadow-[inset_0_0_0_1.5px_var(--line)]";
/** Viền nổi khi đang kéo thẻ qua cột */
const LANE_OVER = "shadow-[inset_0_0_0_2px_var(--barHot)]";

function CountPill({ n }: { n: number }) {
  return (
    <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-pill px-1.5 text-xs font-extrabold text-ink2">
      {n}
    </span>
  );
}

export interface KanbanColumnProps {
  status: TaskStatus;
  /** đã sắp theo hạn chót */
  rows: TaskRow[];
  collapsed: boolean;
  emptyText: string;
  onToggle: (status: TaskStatus) => void;
  onOpen: (id: Id) => void;
  /** chỉ cột Mới / Đang làm / Đang chờ có "+ Thêm việc" */
  onAdd?: (status: TaskStatus) => void;
}

/** Một cột trạng thái (thả thẻ vào = đổi sang trạng thái này). Thu gọn thì thành dải dọc 48px. */
export const KanbanColumn = memo(function KanbanColumn({
  status,
  rows,
  collapsed,
  emptyText,
  onToggle,
  onOpen,
  onAdd,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];

  if (collapsed) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={() => onToggle(status)}
        title="Bấm để mở cột"
        aria-label={`Mở cột ${meta.label}`}
        className={cn(
          LANE,
          "flex w-12 flex-none flex-col items-center gap-2.5 py-3.5 hover:bg-surface",
          isOver && LANE_OVER,
        )}
      >
        <span style={{ color: meta.fg }}>
          <StatusIcon status={status} className="size-[15px]" />
        </span>
        <CountPill n={rows.length} />
        <span className="whitespace-nowrap text-sm font-extrabold [writing-mode:vertical-rl]">
          {meta.label}
        </span>
        <ChevronRight className="size-[15px] text-muted" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={meta.label}
      className={cn(
        LANE,
        "flex max-h-full min-w-[190px] flex-1 flex-col gap-2.5 p-3",
        isOver && LANE_OVER,
      )}
    >
      <div className="flex flex-none items-center gap-2 px-0.5 pt-0.5">
        <StatusChip status={status} className="h-[26px] px-[11px] text-[13px]" />
        <CountPill n={rows.length} />
        <button
          type="button"
          onClick={() => onToggle(status)}
          title="Thu gọn cột"
          aria-label={`Thu gọn cột ${meta.label}`}
          className="ml-auto inline-flex size-[26px] items-center justify-center rounded-full text-muted hover:bg-surface2 hover:text-ink"
        >
          <ChevronLeft className="size-[15px]" aria-hidden="true" />
        </button>
      </div>
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 py-0.5">
        {rows.map((r) => (
          <KanbanCard key={r.id} row={r} onOpen={onOpen} />
        ))}
        {rows.length === 0 && (
          <div className="rounded-[14px] border-[1.5px] border-dashed border-line px-1.5 py-[18px] text-center text-[12.5px] font-semibold text-muted">
            {emptyText}
          </div>
        )}
      </div>
      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd(status)}
          className="flex flex-none items-center gap-2 rounded-nav p-1.5 text-[13px] font-extrabold text-muted hover:text-ink"
        >
          <Plus className="size-[15px]" aria-hidden="true" />
          Thêm việc
        </button>
      )}
    </section>
  );
});
