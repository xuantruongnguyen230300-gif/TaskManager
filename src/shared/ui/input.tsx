import type * as React from "react";
import { cn } from "@/shared/lib/utils";

/** Ô nhập theo docs/04: cao 40px, bo 12px, nền phụ, viền mảnh. `aria-invalid` → viền đỏ. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-field bg-surface2 px-3 text-sm font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--line)] outline-none transition-[box-shadow] placeholder:font-semibold placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:shadow-[inset_0_0_0_1.5px_var(--focus)] focus-visible:outline-none",
        "aria-invalid:shadow-[inset_0_0_0_1.5px_var(--danger)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
