import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import type { TaskDetail, TaskStatus } from "@/shared/api/types";
import { STATUS_META, STATUS_ORDER, statusHasNote } from "@/shared/lib/status";
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { StatusChip, StatusIcon } from "@/shared/ui/status-chip";
import { StatusNoteDialog } from "./StatusNoteDialog";
import { useSetTaskStatus } from "./use-task-detail";

/** Gợi ý tác động khi chuyển (docs/02 §5), hiện cạnh từng trạng thái trong menu. */
function statusHint(t: TaskDetail, s: TaskStatus): string {
  if (s === t.status) return "Hiện tại";
  const parts: string[] = [];
  if (statusHasNote(s)) parts.push("Hỏi lý do");
  else if (s === "in_progress" && t.actualStartAt === null) parts.push("Tự điền Bắt đầu thực tế");
  else if (s === "done") parts.push("Kết thúc thực tế = bây giờ");
  if (!statusHasNote(s) && statusHasNote(t.status) && t.statusNote) parts.push("xoá lý do");
  if (t.status === "done" && t.actualEndAt !== null) parts.push("xoá Kết thúc thực tế");
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Dropdown trạng thái ở đầu SC-5: chuyển tự do; vào Đang chờ / Đã huỷ thì hỏi lý do trước. */
export function StatusMenu({ task }: { task: TaskDetail }) {
  const setStatus = useSetTaskStatus();
  const [ask, setAsk] = useState<"waiting" | "cancelled" | null>(null);
  const meta = STATUS_META[task.status];

  const pick = (s: TaskStatus) => {
    if (s === task.status) return;
    if (s === "waiting" || s === "cancelled") setAsk(s);
    else setStatus.mutate({ id: task.id, status: s });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Đổi trạng thái"
            disabled={setStatus.isPending}
            className={cn(
              "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full pr-2 pl-[11px] text-[13px] font-extrabold disabled:opacity-60",
              meta.chipClass,
            )}
          >
            <StatusIcon status={task.status} className="size-3.5" />
            {meta.label}
            <ChevronDownIcon className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-80 rounded-[18px] p-2"
          style={{ boxShadow: "var(--pop)" }}
        >
          <DropdownMenuLabel className="px-2.5 pt-1 pb-1.5 text-xs font-extrabold text-muted">
            Chuyển sang
          </DropdownMenuLabel>
          {STATUS_ORDER.map((s) => {
            const current = s === task.status;
            return (
              <DropdownMenuItem
                key={s}
                onSelect={() => pick(s)}
                className={cn(
                  "gap-2.5 rounded-[12px] px-2.5 py-[7px] [&_svg:not([class*='text-'])]:text-current",
                  current && "bg-hero focus:bg-hero",
                )}
              >
                <StatusChip status={s} />
                <span className="min-w-0 flex-1 text-xs font-semibold text-muted">
                  {statusHint(task, s)}
                </span>
                {current && <CheckIcon className="size-[15px] text-ink" aria-hidden="true" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <StatusNoteDialog
        open={ask !== null}
        status={ask ?? "waiting"}
        pending={setStatus.isPending}
        onCancel={() => setAsk(null)}
        onConfirm={(note) => {
          if (!ask) return;
          setStatus.mutate(
            { id: task.id, status: ask, note: note || null },
            { onSuccess: () => setAsk(null) },
          );
        }}
      />
    </>
  );
}
