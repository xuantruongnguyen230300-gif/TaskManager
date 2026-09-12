import type { AssigneeFilter, DueFilter, TaskStatus } from "@/shared/api/types";
import { STATUS_ORDER } from "@/shared/lib/status";

/**
 * Search params của SC-2 Công việc (bộ lọc nằm trên URL để giữ khi mở/đóng Chi tiết việc).
 * Mọi khoá tuỳ chọn; vắng = mặc định.
 */
export interface TasksSearch {
  /** từ khoá tìm theo mã/tiêu đề (đồng bộ với ô tìm ở thanh trên) */
  q?: string;
  /** lọc Dự án (chọn nhiều) */
  projects?: number[];
  /** lọc Người phụ trách (chọn nhiều, "unassigned" = Chưa giao) */
  assignees?: AssigneeFilter[];
  /** lọc Trạng thái: vắng = Mới + Đang làm + Đang chờ; `[]` = mọi trạng thái */
  statuses?: TaskStatus[];
  /** lọc Hạn */
  due?: DueFilter;
}

const DUE_VALUES: readonly unknown[] = ["overdue", "thisWeek", "noDue"];

function isId(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

export function validateTasksSearch(search: Record<string, unknown>): TasksSearch {
  const out: TasksSearch = {};
  const rawQ = search.q;
  const q = (typeof rawQ === "string" ? rawQ : typeof rawQ === "number" ? String(rawQ) : "").trim();
  if (q) out.q = q;

  const projects = search.projects;
  if (Array.isArray(projects)) {
    const ids = projects.filter(isId);
    if (ids.length) out.projects = ids;
  }

  const assignees = search.assignees;
  if (Array.isArray(assignees)) {
    const list = assignees.filter((v): v is AssigneeFilter => v === "unassigned" || isId(v));
    if (list.length) out.assignees = list;
  }

  const statuses = search.statuses;
  if (Array.isArray(statuses)) out.statuses = STATUS_ORDER.filter((s) => statuses.includes(s));

  if (DUE_VALUES.includes(search.due)) out.due = search.due as DueFilter;
  return out;
}
