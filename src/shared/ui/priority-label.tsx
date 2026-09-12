import { Flag } from "lucide-react";
import type { Priority } from "@/shared/api/types";
import { PRIORITY_META } from "@/shared/lib/priority";
import { cn } from "@/shared/lib/utils";

/** Ưu tiên = icon cờ + chữ màu, không nền (docs/04 §2, §3.2). */
export function PriorityLabel({
  priority,
  className,
  iconOnly = false,
}: {
  priority: Priority;
  className?: string;
  iconOnly?: boolean;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-extrabold",
        meta.textClass,
        className,
      )}
      title={iconOnly ? meta.label : undefined}
    >
      <Flag className="size-[14px]" strokeWidth={2.4} aria-hidden="true" />
      {!iconOnly && meta.label}
    </span>
  );
}
