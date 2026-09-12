import { Check, ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/** Nút bộ lọc + popover (design/Tasks.dc.html: .fbtn / .pop). `count` > 0 = đang lọc. */
export function FilterMenu({
  label,
  head,
  count,
  width,
  children,
}: {
  label: string;
  head: string;
  count: number;
  width: number;
  /** `close` để đóng popover sau khi chọn (bộ lọc chọn một) */
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const active = count > 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-3 font-extrabold text-[13px] text-ink2 shadow-[var(--shadow),inset_0_0_0_1.5px_var(--line)] hover:text-ink",
            active && "bg-hero text-hero-ink shadow-none hover:text-hero-ink",
            open && "shadow-[inset_0_0_0_2px_var(--barHot)]",
          )}
        >
          {label}
          {active && (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-hero-ink px-[5px] text-[11px] text-surface">
              {count}
            </span>
          )}
          <ChevronDown className="size-[13px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        style={{ width }}
        className="flex max-h-[min(440px,var(--radix-popover-content-available-height))] flex-col gap-0.5 overflow-y-auto rounded-[18px] border-0 p-2 shadow-[var(--pop),inset_0_0_0_1px_var(--line)]"
      >
        <div className="px-2.5 pt-1 pb-1.5 text-label">{head}</div>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

/** Một dòng lựa chọn: ô tick (chọn nhiều) hoặc nút tròn (chọn một). */
export function FilterOption({
  selected,
  mode,
  onSelect,
  children,
}: {
  selected: boolean;
  mode: "check" | "radio";
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="flex min-h-[34px] w-full flex-none items-center gap-2.5 whitespace-nowrap rounded-[10px] px-2.5 text-left font-bold text-[13.5px] hover:bg-surface2"
    >
      {mode === "check" ? (
        <span
          className={cn(
            "inline-flex size-[18px] flex-none items-center justify-center rounded-[6px] text-btn-ink",
            selected ? "bg-btn" : "shadow-[inset_0_0_0_2px_var(--muted)]",
          )}
        >
          {selected && <Check className="size-3" strokeWidth={3.4} />}
        </span>
      ) : (
        <span
          className={cn(
            "inline-flex size-[18px] flex-none rounded-full",
            selected
              ? "shadow-[inset_0_0_0_5px_var(--btn)]"
              : "shadow-[inset_0_0_0_2px_var(--muted)]",
          )}
        />
      )}
      {children}
    </button>
  );
}
