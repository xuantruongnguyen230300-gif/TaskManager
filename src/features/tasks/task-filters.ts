/**
 * Lọc + sắp xếp bảng Công việc phía client (SC-2). Dữ liệu lấy một lần (mọi trạng thái) rồi lọc
 * tại chỗ để bấm lọc/gõ tìm phản hồi ngay, kể cả 5.000 việc.
 */
import { addDays, startOfWeek } from "date-fns";
import type { AssigneeFilter, DueFilter, TaskRow, TaskStatus } from "@/shared/api/types";
import { isOverdue, toIsoDate } from "@/shared/lib/date";
import { foldVi } from "@/shared/lib/fold-vi";
import { OPEN_STATUSES, STATUS_ORDER } from "@/shared/lib/status";

/** Các cột của bảng Công việc (docs/02 SC-2). */
export type TaskColumn =
  | "code"
  | "title"
  | "project"
  | "assignee"
  | "status"
  | "priority"
  | "startDate"
  | "dueDate"
  | "creator"
  | "createdAt"
  /** chỉ hiện khi được yêu cầu (SC-7 tab Đã hoàn thành) */
  | "actualEnd";

export type SortDir = "asc" | "desc";

export interface TaskSort {
  key: TaskColumn;
  dir: SortDir;
}

/** Mặc định: Ngày tạo, mới nhất trước. */
export const DEFAULT_SORT: TaskSort = { key: "createdAt", dir: "desc" };

export interface TaskCriteria {
  q?: string;
  projects?: readonly number[];
  assignees?: readonly AssigneeFilter[];
  /** vắng = 3 trạng thái đang mở; rỗng = mọi trạng thái */
  statuses?: readonly TaskStatus[];
  due?: DueFilter;
}

// Đệm chữ đã bỏ dấu (tiêu đề/tên lặp lại giữa các lần lọc, sắp).
const foldCache = new Map<string, string>();
function fold(s: string): string {
  let v = foldCache.get(s);
  if (v === undefined) {
    if (foldCache.size > 20000) foldCache.clear();
    v = foldVi(s);
    foldCache.set(s, v);
  }
  return v;
}

/** Thứ Hai → Chủ nhật của tuần hiện tại, dạng "YYYY-MM-DD". */
export function weekBounds(now: Date = new Date()): { monday: string; sunday: string } {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  return { monday: toIsoDate(monday), sunday: toIsoDate(addDays(monday, 6)) };
}

function dueTest(due: DueFilter | undefined, now: Date): ((r: TaskRow) => boolean) | null {
  if (!due) return null;
  if (due === "overdue") return (r) => isOverdue(r, now);
  if (due === "noDue") return (r) => r.dueDate == null;
  const { monday, sunday } = weekBounds(now);
  return (r) => r.dueDate != null && r.dueDate >= monday && r.dueDate <= sunday;
}

/** Lọc theo Dự án · Người phụ trách · Trạng thái · Hạn · từ khoá (mã/tiêu đề, bỏ dấu — R-11). */
export function filterTaskRows(
  rows: readonly TaskRow[],
  c: TaskCriteria,
  now: Date = new Date(),
): TaskRow[] {
  const statuses = c.statuses ?? OPEN_STATUSES;
  const statusSet = statuses.length ? new Set(statuses) : null;
  const projectSet = c.projects?.length ? new Set(c.projects) : null;
  const assigneeSet = c.assignees?.length ? new Set<AssigneeFilter>(c.assignees) : null;
  const needle = c.q ? foldVi(c.q.trim()) : "";
  const passDue = dueTest(c.due, now);
  return rows.filter(
    (r) =>
      (!statusSet || statusSet.has(r.status)) &&
      (!projectSet || projectSet.has(r.projectId)) &&
      (!assigneeSet || assigneeSet.has(r.assigneeId ?? "unassigned")) &&
      (!passDue || passDue(r)) &&
      (!needle || fold(`${r.code} ${r.title}`).includes(needle)),
  );
}

/** "WEB-9" < "WEB-12": mã dự án rồi số thứ tự. */
function codeKey(r: TaskRow): string {
  const n = Number(r.code.slice(r.code.lastIndexOf("-") + 1)) || 0;
  return `${r.projectCode}-${String(n).padStart(9, "0")}`;
}

type SortValue = string | number | null;

function sortValue(r: TaskRow, key: TaskColumn): SortValue {
  switch (key) {
    case "code":
      return codeKey(r);
    case "title":
      return fold(r.title);
    case "project":
      return r.projectCode;
    case "assignee":
      return r.assigneeName == null ? null : fold(r.assigneeName);
    case "status":
      return STATUS_ORDER.indexOf(r.status);
    case "priority":
      return r.priority;
    case "startDate":
      return r.startDate;
    case "dueDate":
      return r.dueDate;
    case "creator":
      return fold(r.creatorName);
    case "createdAt":
      return r.createdAt;
    case "actualEnd":
      return r.actualEndAt ?? null;
  }
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Sắp theo một cột; ô trống (không hạn, Chưa giao…) luôn ở cuối; bằng nhau thì theo mã. */
export function sortTaskRows(rows: readonly TaskRow[], sort: TaskSort): TaskRow[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  const items = rows.map((row) => ({ row, v: sortValue(row, sort.key), c: codeKey(row) }));
  items.sort((a, b) => {
    if (a.v !== b.v) {
      if (a.v == null) return 1;
      if (b.v == null) return -1;
      const d = compareValues(a.v, b.v);
      if (d !== 0) return d * sign;
    }
    return a.c < b.c ? -1 : a.c > b.c ? 1 : 0;
  });
  return items.map((i) => i.row);
}
