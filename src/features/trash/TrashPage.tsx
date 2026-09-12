import { addDays, format } from "date-fns";
import { Clock, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import type { TrashRow } from "@/shared/api/types";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { ProjectDot } from "@/shared/ui/project-dot";
import { useTrash, useTrashActions } from "./use-trash";

const GRID =
  "grid grid-cols-[64px_minmax(0,1fr)_190px_110px_120px_240px] items-center gap-x-3 px-3";
const RETENTION_DAYS = 30;

/** SC-8 Thùng rác: Khôi phục · Xoá vĩnh viễn (xác nhận) · Dọn sạch (xác nhận). */
export function TrashPage() {
  const trash = useTrash();
  const [purgeRow, setPurgeRow] = useState<TrashRow | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const { restore, purge, empty } = useTrashActions({
    onPurged: () => setPurgeRow(null),
    onEmptied: () => setEmptyOpen(false),
  });

  // Mới xoá nhất lên đầu.
  const rows = useMemo(
    () => [...(trash.data ?? [])].sort((a, b) => b.deletedAt - a.deletedAt),
    [trash.data],
  );
  const n = rows.length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end gap-4 px-1.5 pt-1.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">Thùng rác</h1>
          <div className="text-sub">
            {trash.isPending ? "Đang tải…" : n ? `${n} việc` : "Không có việc nào"}
          </div>
        </div>
        <Button
          variant="destructive"
          className="ml-auto"
          disabled={n === 0}
          onClick={() => setEmptyOpen(true)}
        >
          <Trash2 className="size-[15px]" />
          Dọn sạch thùng rác
        </Button>
      </div>

      <div className="flex items-center gap-2.5 rounded-nav bg-surface px-3.5 py-2.5 font-bold text-[13.5px] text-ink2 shadow-card">
        <Clock className="text-hero-ink" />
        Việc trong thùng rác tự xoá vĩnh viễn sau 30 ngày.
        <span className="ml-auto whitespace-nowrap text-[12.5px] text-muted">
          Việc còn 7 ngày trở xuống được tô màu cảnh báo
        </span>
      </div>

      {trash.isError ? (
        <div className="rounded-card bg-surface px-5 py-[18px] text-sub shadow-card">
          {errorMessage(trash.error)}
        </div>
      ) : trash.isPending ? null : n > 0 ? (
        <div className="flex flex-col rounded-card bg-surface px-5 py-[18px] shadow-card">
          <div className={cn(GRID, "border-line border-b-[1.5px] pt-0.5 pb-[9px] text-label")}>
            <span>Mã</span>
            <span>Tiêu đề</span>
            <span>Dự án</span>
            <span>Xoá lúc</span>
            <span>Còn lại</span>
            <span className="text-right">Thao tác</span>
          </div>
          {rows.map((r) => (
            <TrashItem
              key={r.id}
              row={r}
              restoring={restore.isPending && restore.variables?.id === r.id}
              onRestore={() => restore.mutate(r)}
              onPurge={() => setPurgeRow(r)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2.5 rounded-card bg-surface px-5 py-16 text-center shadow-card">
          <div className="flex size-[72px] items-center justify-center rounded-full bg-surface2 text-muted">
            <Trash2 className="size-8" strokeWidth={1.8} />
          </div>
          <div className="font-extrabold text-[18px]">Thùng rác trống</div>
          <div className="max-w-[420px] text-sub leading-normal">
            Việc bị xoá sẽ nằm ở đây 30 ngày để bạn khôi phục khi cần, sau đó tự xoá vĩnh viễn.
          </div>
        </div>
      )}

      <ConfirmDialog
        open={purgeRow !== null}
        onOpenChange={(open) => !open && !purge.isPending && setPurgeRow(null)}
        title={purgeRow ? `Xoá vĩnh viễn ${purgeRow.code}?` : ""}
        description={
          purgeRow && (
            <>
              <span className="mb-1.5 block font-bold text-ink">
                “{purgeRow.title}” · {purgeRow.projectName}
              </span>
              <span className="block">
                Việc, việc con, bình luận, tệp đính kèm và lịch sử sẽ bị xoá và không thể khôi phục.
              </span>
            </>
          )
        }
        confirmLabel="Xoá vĩnh viễn"
        pending={purge.isPending}
        onConfirm={() => purgeRow && purge.mutate(purgeRow)}
      />

      <ConfirmDialog
        open={emptyOpen}
        onOpenChange={(open) => !open && !empty.isPending && setEmptyOpen(false)}
        title="Dọn sạch Thùng rác?"
        description={`${n} việc sẽ bị xoá vĩnh viễn và không thể khôi phục.`}
        confirmLabel="Dọn sạch"
        pending={empty.isPending}
        onConfirm={() => empty.mutate()}
      />
    </div>
  );
}

function TrashItem({
  row,
  restoring,
  onRestore,
  onPurge,
}: {
  row: TrashRow;
  restoring: boolean;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const deleted = new Date(row.deletedAt);
  const warn = row.daysLeft <= 7;
  return (
    <div className={cn(GRID, "border-line border-b py-[11px]")}>
      <span className="text-code">{row.code}</span>
      <span className="min-w-0 break-words text-task">{row.title}</span>
      <span className="flex min-w-0 items-center gap-2">
        <ProjectDot color={row.projectColor} />
        <span className="truncate font-bold text-[13.5px]">{row.projectName}</span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-bold text-[13.5px] tabular-nums">
          {format(deleted, "dd/MM/yyyy")}
        </span>
        <span className="text-[12.5px] text-muted tabular-nums">{format(deleted, "HH:mm")}</span>
      </span>
      <span className="flex flex-col items-start gap-[3px]">
        <span
          className={cn(
            "inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-chip px-[9px] font-extrabold text-xs",
            warn ? "bg-warn-bg text-warn" : "bg-pill text-ink2",
          )}
        >
          {warn && <TriangleAlert className="size-[13px]" strokeWidth={2.4} />}
          còn {row.daysLeft} ngày
        </span>
        <span className="whitespace-nowrap text-[12.5px] text-muted">
          tự xoá {format(addDays(deleted, RETENTION_DAYS), "dd/MM")}
        </span>
      </span>
      <span className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" disabled={restoring} onClick={onRestore}>
          <Undo2 />
          Khôi phục
        </Button>
        <Button variant="outline" size="sm" className="text-danger" onClick={onPurge}>
          Xoá vĩnh viễn
        </Button>
      </span>
    </div>
  );
}
