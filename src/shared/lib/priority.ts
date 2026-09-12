import type { Priority } from "@/shared/api/types";

export const PRIORITY_ORDER: readonly Priority[] = [1, 2, 3, 4];
export const DEFAULT_PRIORITY: Priority = 2;

export interface PriorityMeta {
  label: string;
  /** class màu chữ (icon cờ + chữ, không nền) */
  textClass: string;
  color: string;
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  1: { label: "Thấp", textClass: "text-prio-1", color: "var(--prio-1)" },
  2: { label: "Trung bình", textClass: "text-prio-2", color: "var(--prio-2)" },
  3: { label: "Cao", textClass: "text-prio-3", color: "var(--prio-3)" },
  4: { label: "Khẩn cấp", textClass: "text-prio-4", color: "var(--prio-4)" },
};

export function priorityLabel(p: Priority): string {
  return PRIORITY_META[p].label;
}
