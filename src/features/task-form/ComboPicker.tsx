import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { includesFolded } from "@/shared/lib/fold-vi";
import { cn } from "@/shared/lib/utils";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export interface ComboOption {
  /** khoá duy nhất */
  value: string;
  /** chữ dùng để tìm (không phân biệt dấu) */
  search: string;
  content: ReactNode;
}

/**
 * Ô chọn kiểu combobox (Popover + Command, docs/04 §6): nút giống ô nhập, danh sách có ô tìm,
 * mục đang chọn tô nền nhấn + dấu ✓, ghi chú nhỏ ở cuối danh sách.
 */
export function ComboPicker({
  value,
  options,
  onSelect,
  children,
  searchPlaceholder = "Tìm…",
  footnote,
  invalid = false,
  size = "default",
  id,
  ariaLabel,
  className,
}: {
  value: string;
  options: ComboOption[];
  onSelect: (value: string) => void;
  /** nội dung hiển thị trong ô */
  children: ReactNode;
  searchPlaceholder?: string;
  footnote?: string;
  invalid?: boolean;
  size?: "default" | "sm";
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex w-full min-w-0 items-center gap-2 rounded-field bg-surface2 text-left font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--line)] outline-none transition-[box-shadow] hover:shadow-[inset_0_0_0_1.5px_var(--bar)]",
            size === "sm" ? "h-8 pr-2 pl-[5px] text-[13px]" : "h-10 px-3 text-sm",
            open &&
              "shadow-[inset_0_0_0_2px_var(--focus)] hover:shadow-[inset_0_0_0_2px_var(--focus)]",
            invalid && "shadow-[inset_0_0_0_1.5px_var(--danger)]",
            className,
          )}
        >
          {children}
          <ChevronDownIcon
            className="ml-auto size-[15px] flex-none text-muted"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-64 rounded-[18px] p-0"
        style={{ boxShadow: "var(--pop)" }}
      >
        <Command
          className="rounded-[18px]"
          filter={(v, search, keywords) =>
            includesFolded(keywords?.join(" ") ?? v, search) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="p-1.5">
            <CommandEmpty className="py-4 text-center text-sub">Không có kết quả.</CommandEmpty>
            {options.map((o) => {
              const selected = o.value === value;
              return (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  keywords={[o.search]}
                  onSelect={() => {
                    onSelect(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "gap-2.5 rounded-[12px] px-2.5 py-[7px] text-sm font-bold",
                    selected && "bg-hero data-[selected=true]:bg-hero",
                  )}
                >
                  {o.content}
                  {selected && (
                    <CheckIcon className="ml-auto size-[15px] text-ink" aria-hidden="true" />
                  )}
                </CommandItem>
              );
            })}
          </CommandList>
          {footnote && (
            <div className="border-t px-3 pt-1.5 pb-2 text-[11.5px] font-bold text-muted">
              {footnote}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
