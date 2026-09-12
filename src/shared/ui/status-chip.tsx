import type { TaskStatus } from "@/shared/api/types";
import { STATUS_META } from "@/shared/lib/status";
import { cn } from "@/shared/lib/utils";

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(
        "size-[13px] flex-none fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.4]",
        className,
      )}
    >
      <path d={STATUS_META[status].iconPath} />
    </svg>
  );
}

/** Chip trạng thái: nền + chữ màu theo trạng thái, có icon (docs/04 §2, §3.1). */
export function StatusChip({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-chip px-[9px] text-xs font-extrabold",
        meta.chipClass,
        className,
      )}
    >
      <StatusIcon status={status} />
      {meta.label}
    </span>
  );
}
