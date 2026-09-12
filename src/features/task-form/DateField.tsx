import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { vi } from "react-day-picker/locale";
import { formatDate, parseIsoDate, todayIso, toIsoDate } from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Chọn ngày (không có giờ), tuần bắt đầu thứ Hai, có nút xoá. Giá trị "YYYY-MM-DD" | null. */
export function DateField({
  value,
  onChange,
  invalid = false,
  id,
  clearLabel = "Xoá ngày",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  invalid?: boolean;
  id?: string;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? parseIsoDate(value) : undefined;
  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "flex h-10 min-w-0 items-center rounded-field bg-surface2 shadow-[inset_0_0_0_1.5px_var(--line)] transition-[box-shadow] hover:shadow-[inset_0_0_0_1.5px_var(--bar)]",
            open &&
              "shadow-[inset_0_0_0_2px_var(--focus)] hover:shadow-[inset_0_0_0_2px_var(--focus)]",
            invalid && "shadow-[inset_0_0_0_1.5px_var(--danger)]",
          )}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              aria-invalid={invalid || undefined}
              className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-field px-3 text-left text-sm font-bold text-ink outline-none"
            >
              <CalendarIcon className="size-[15px] flex-none text-muted" aria-hidden="true" />
              {date && value ? (
                <span className="truncate">{`${DOW[date.getDay()]}, ${formatDate(value)}`}</span>
              ) : (
                <span className="truncate font-semibold text-muted">Chọn ngày</span>
              )}
            </button>
          </PopoverTrigger>
          {value && (
            <button
              type="button"
              title={clearLabel}
              aria-label={clearLabel}
              onClick={() => onChange(null)}
              className="mr-2 inline-flex size-5 flex-none items-center justify-center rounded-full text-ink opacity-70 hover:bg-line hover:opacity-100"
            >
              <XIcon className="size-3" strokeWidth={2.6} aria-hidden="true" />
            </button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-auto rounded-[18px] p-3"
        style={{ boxShadow: "var(--pop)" }}
      >
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(d) => d && pick(toIsoDate(d))}
          locale={vi}
          weekStartsOn={1}
          className="p-0"
        />
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="secondary" onClick={() => pick(todayIso())}>
            Hôm nay
          </Button>
          <Button size="sm" variant="outline" onClick={() => pick(null)}>
            Xoá ngày
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
