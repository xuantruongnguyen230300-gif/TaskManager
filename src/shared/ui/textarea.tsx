import type * as React from "react";
import { cn } from "@/shared/lib/utils";

/** Ô chữ nhiều dòng, cùng kiểu với Input (bo 12px, nền phụ, viền mảnh). */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content flex min-h-20 w-full rounded-field bg-surface2 px-3 py-2.5 text-sm font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--line)] outline-none transition-[box-shadow] placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:shadow-[inset_0_0_0_1.5px_var(--focus)] focus-visible:outline-none",
        "aria-invalid:shadow-[inset_0_0_0_1.5px_var(--danger)]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
