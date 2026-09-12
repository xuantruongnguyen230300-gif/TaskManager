import { useMemo } from "react";
import type { Id, TaskRow } from "@/shared/api/types";
import { cn } from "@/shared/lib/utils";
import { Avatar } from "@/shared/ui/avatar";

/** id người phụ trách, "unassigned" = Chưa giao */
export type AssigneeKey = Id | "unassigned";

export function assigneeKey(r: TaskRow): AssigneeKey {
  return r.assigneeId ?? "unassigned";
}

interface Person {
  key: AssigneeKey;
  name: string | null;
  color: string | null;
  inactive: boolean;
  count: number;
}

/**
 * Lọc theo người phụ trách (SC-3, dùng cho cả Kanban và Danh sách): "Tất cả" + dãy avatar của
 * những người đang có việc trong dự án. Chọn được nhiều người.
 */
export function AssigneeFilter({
  rows,
  selected,
  onChange,
}: {
  rows: TaskRow[];
  selected: AssigneeKey[];
  onChange: (next: AssigneeKey[]) => void;
}) {
  const people = useMemo(() => {
    const map = new Map<AssigneeKey, Person>();
    for (const r of rows) {
      const key = assigneeKey(r);
      const p = map.get(key);
      if (p) p.count += 1;
      else
        map.set(key, {
          key,
          name: r.assigneeName,
          color: r.assigneeColor,
          inactive: r.assigneeInactive,
          count: 1,
        });
    }
    return [...map.values()].sort((a, b) => {
      if (a.name === null) return 1;
      if (b.name === null) return -1;
      return a.name.localeCompare(b.name, "vi");
    });
  }, [rows]);

  const any = selected.length > 0;
  const names = people.filter((p) => selected.includes(p.key)).map((p) => p.name ?? "Chưa giao");
  const toggle = (key: AssigneeKey) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <div className="flex flex-none flex-wrap items-center gap-2 px-1">
      <span className="mr-0.5 text-label">NGƯỜI PHỤ TRÁCH</span>
      <button
        type="button"
        aria-pressed={!any}
        onClick={() => onChange([])}
        className={cn(
          "inline-flex h-[30px] items-center rounded-full px-3 text-[13px] font-extrabold shadow-card",
          any ? "bg-surface text-ink2" : "bg-btn text-btn-ink",
        )}
      >
        Tất cả
      </button>
      {people.map((p) => {
        const on = selected.includes(p.key);
        const label = `${p.name ?? "Chưa giao"}${p.inactive ? " · Đã nghỉ" : ""} — ${p.count} việc`;
        return (
          <button
            key={String(p.key)}
            type="button"
            aria-pressed={on}
            aria-label={label}
            title={label}
            onClick={() => toggle(p.key)}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full transition-opacity",
              on && "shadow-[0_0_0_2px_var(--barHot)]",
              !on && any && "opacity-40",
            )}
          >
            <Avatar name={p.name} color={p.color} className="size-[26px]" />
          </button>
        );
      })}
      {any && (
        <span className="ml-1 text-[12.5px] font-semibold text-muted">
          Đang lọc: {names.join(", ")}
        </span>
      )}
    </div>
  );
}
