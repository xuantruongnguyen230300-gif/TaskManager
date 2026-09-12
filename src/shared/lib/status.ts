import type { TaskStatus } from "@/shared/api/types";

export const STATUS_ORDER: readonly TaskStatus[] = [
  "new",
  "in_progress",
  "waiting",
  "done",
  "cancelled",
];

/** "Đang mở" = Mới + Đang làm + Đang chờ (cũng là bộ lọc mặc định của SC-2). */
export const OPEN_STATUSES: readonly TaskStatus[] = ["new", "in_progress", "waiting"];

export interface StatusMeta {
  label: string;
  /** class Tailwind cho chip (nền + chữ theo token sáng/tối) */
  chipClass: string;
  /** màu dùng inline khi cần: var(--st-…-bg/fg) */
  bg: string;
  fg: string;
  /** path SVG (lưới 24, nét 2) giống prototype */
  iconPath: string;
}

const CIRCLE = "M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z";

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  new: {
    label: "Mới",
    chipClass: "bg-st-new-bg text-st-new-fg",
    bg: "var(--st-new-bg)",
    fg: "var(--st-new-fg)",
    iconPath: CIRCLE,
  },
  in_progress: {
    label: "Đang làm",
    chipClass: "bg-st-progress-bg text-st-progress-fg",
    bg: "var(--st-progress-bg)",
    fg: "var(--st-progress-fg)",
    iconPath: `${CIRCLE}M12 3v18`,
  },
  waiting: {
    label: "Đang chờ",
    chipClass: "bg-st-waiting-bg text-st-waiting-fg",
    bg: "var(--st-waiting-bg)",
    fg: "var(--st-waiting-fg)",
    iconPath: `${CIRCLE}M10 9v6M14 9v6`,
  },
  done: {
    label: "Hoàn thành",
    chipClass: "bg-st-done-bg text-st-done-fg",
    bg: "var(--st-done-bg)",
    fg: "var(--st-done-fg)",
    iconPath: `${CIRCLE}M8.5 12.5l2.5 2.5 4.5-5`,
  },
  cancelled: {
    label: "Đã huỷ",
    chipClass: "bg-st-cancelled-bg text-st-cancelled-fg",
    bg: "var(--st-cancelled-bg)",
    fg: "var(--st-cancelled-fg)",
    iconPath: `${CIRCLE}M9 9l6 6M15 9l-6 6`,
  },
};

export function statusLabel(s: TaskStatus): string {
  return STATUS_META[s].label;
}

export function isOpenStatus(s: TaskStatus): boolean {
  return OPEN_STATUSES.includes(s);
}

/** Trạng thái có ô lý do (Đang chờ / Đã huỷ). */
export function statusHasNote(s: TaskStatus): boolean {
  return s === "waiting" || s === "cancelled";
}

/** "Lý do chờ" / "Lý do huỷ" */
export function statusNoteLabel(s: TaskStatus): string {
  return s === "cancelled" ? "Lý do huỷ" : "Lý do chờ";
}
