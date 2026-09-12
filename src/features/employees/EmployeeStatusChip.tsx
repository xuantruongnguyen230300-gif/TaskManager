import type { EmployeeStatus } from "@/shared/api/types";
import { cn } from "@/shared/lib/utils";

/** Chip trạng thái nhân viên: chấm màu + "Đang làm việc" / "Đã nghỉ". */
export function EmployeeStatusChip({ status }: { status: EmployeeStatus }) {
  const inactive = status === "inactive";
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-chip px-[9px] text-xs font-extrabold",
        inactive ? "bg-warn-bg text-warn" : "bg-pill text-ink2",
      )}
    >
      <span
        className={cn("size-[7px] flex-none rounded-full", inactive ? "bg-warn" : "bg-[#4DBB7F]")}
      />
      {inactive ? "Đã nghỉ" : "Đang làm việc"}
    </span>
  );
}

/** Nhãn "Tôi" cạnh tên hồ sơ của manager. */
export function SelfChip() {
  return (
    <span className="inline-flex h-5 flex-none items-center rounded-chip bg-hero px-2 text-[11px] font-extrabold text-hero-ink">
      Tôi
    </span>
  );
}
