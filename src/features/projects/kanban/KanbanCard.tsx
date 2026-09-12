import { useDraggable } from "@dnd-kit/core";
import { CalendarDays, ListChecks, MessageSquare, Paperclip } from "lucide-react";
import { memo } from "react";
import type { Id, TaskRow } from "@/shared/api/types";
import { formatShortDate, isOverdue, overdueDays, overdueLabel } from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";
import { Avatar, InactiveBadge } from "@/shared/ui/avatar";
import { PriorityLabel } from "@/shared/ui/priority-label";

/** Khung thẻ Kanban (bo 16px). Dùng cho thẻ trong cột và bản nổi khi kéo. */
export const CARD_CLASS =
  "flex w-full flex-none touch-none select-none flex-col gap-2 rounded-kanban px-3.5 py-3 text-left shadow-card";

const MINI =
  "inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold text-muted [&_svg]:size-3.5";

/** Mã · ưu tiên · tiêu đề · người phụ trách · hạn · số việc con / bình luận / tệp. */
export const KanbanCardBody = memo(function KanbanCardBody({ row }: { row: TaskRow }) {
  const overdue = isOverdue(row);
  const hasMeta =
    row.dueDate !== null || row.subtaskTotal > 0 || row.commentCount > 0 || row.attachmentCount > 0;
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="text-code">{row.code}</span>
        <PriorityLabel priority={row.priority} className="ml-auto text-xs" />
      </span>
      <span
        className={cn(
          "text-sm leading-[1.35] font-bold text-ink",
          row.status === "cancelled" && "font-semibold text-muted line-through",
        )}
      >
        {row.title}
      </span>
      <span className="flex min-w-0 items-center gap-[7px]">
        <Avatar name={row.assigneeName} color={row.assigneeColor} className="size-[22px]" />
        <span
          className={cn(
            "truncate text-[12.5px] font-bold",
            row.assigneeName ? "text-ink2" : "text-muted",
          )}
        >
          {row.assigneeName ?? "Chưa giao"}
        </span>
        {row.assigneeInactive && <InactiveBadge />}
      </span>
      {hasMeta && (
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {row.dueDate !== null && (
            <span className="inline-flex flex-col gap-px">
              <span className={cn(MINI, overdue && "text-danger")}>
                <CalendarDays aria-hidden="true" />
                {formatShortDate(row.dueDate)}
              </span>
              {overdue && (
                <span className="whitespace-nowrap text-[11px] font-bold text-danger">
                  {overdueLabel(overdueDays(row.dueDate))}
                </span>
              )}
            </span>
          )}
          {row.subtaskTotal > 0 && (
            <span className={MINI} title="Việc con đã xong / tổng">
              <ListChecks aria-hidden="true" />
              {row.subtaskDone}/{row.subtaskTotal}
            </span>
          )}
          {row.commentCount > 0 && (
            <span className={MINI} title="Bình luận">
              <MessageSquare aria-hidden="true" />
              {row.commentCount}
            </span>
          )}
          {row.attachmentCount > 0 && (
            <span className={MINI} title="Tệp đính kèm">
              <Paperclip aria-hidden="true" />
              {row.attachmentCount}
            </span>
          )}
        </span>
      )}
    </>
  );
});

/** Thẻ kéo được. Bấm (không kéo) = mở Chi tiết việc; kéo bắt đầu sau 5px nên bấm vẫn nhạy. */
export const KanbanCard = memo(function KanbanCard({
  row,
  onOpen,
}: {
  row: TaskRow;
  onOpen: (id: Id) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(row.id)}
      title={`${row.code} · ${row.title}`}
      className={cn(
        CARD_CLASS,
        "cursor-pointer hover:shadow-[inset_0_0_0_1.5px_var(--bar)]",
        isOverdue(row) ? "bg-overdue-row" : "bg-surface",
        isDragging && "opacity-40",
      )}
    >
      <KanbanCardBody row={row} />
    </button>
  );
});
