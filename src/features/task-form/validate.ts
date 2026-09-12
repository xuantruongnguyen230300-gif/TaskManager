/**
 * Kiểm tra form Tạo / Sửa việc (docs/02 §3, §6). Câu lỗi khớp `domain::validate` ở Rust.
 * Hàm thuần → test được không cần giao diện.
 */

export const TITLE_MAX = 500;
export const SUBTASK_MAX = 500;
export const COMMENT_MAX = 5000;
/** R-09: mỗi tệp tối đa 50 MB. */
export const FILE_MAX_BYTES = 50 * 1024 * 1024;

export const MSG = {
  projectRequired: "Vui lòng chọn dự án.",
  titleRequired: "Vui lòng nhập tiêu đề.",
  titleTooLong: "Tiêu đề tối đa 500 ký tự.",
  creatorRequired: "Vui lòng chọn người tạo.",
  startAfterDue: "Ngày bắt đầu phải trước hoặc bằng hạn chót.",
  subtaskTooLong: "Việc con tối đa 500 ký tự.",
  commentTooLong: "Bình luận tối đa 5.000 ký tự.",
} as const;

export type TaskFormField =
  | "projectId"
  | "title"
  | "assigneeId"
  | "creatorId"
  | "startDate"
  | "subtasks"
  | "files";

export type TaskFormErrors = Partial<Record<TaskFormField, string>>;

export interface TaskFormCheck {
  projectId: number | null;
  title: string;
  creatorId: number | null;
  /** "YYYY-MM-DD" */
  startDate: string | null;
  dueDate: string | null;
  subtasks: readonly string[];
}

/** Đếm ký tự theo code point (khớp `chars().count()` của Rust). */
export function charCount(s: string): number {
  return Array.from(s).length;
}

export function validateTaskForm(v: TaskFormCheck): TaskFormErrors {
  const e: TaskFormErrors = {};
  if (v.projectId == null) e.projectId = MSG.projectRequired;
  const title = v.title.trim();
  if (!title) e.title = MSG.titleRequired;
  else if (charCount(title) > TITLE_MAX) e.title = MSG.titleTooLong;
  if (v.creatorId == null) e.creatorId = MSG.creatorRequired;
  // R-06: ngày lịch "YYYY-MM-DD" so sánh chuỗi được.
  if (v.startDate && v.dueDate && v.startDate > v.dueDate) e.startDate = MSG.startAfterDue;
  if (v.subtasks.some((s) => charCount(s.trim()) > SUBTASK_MAX)) e.subtasks = MSG.subtaskTooLong;
  return e;
}

/** Lỗi "thiếu giá trị" chỉ hiện sau lần bấm lưu đầu tiên; lỗi sai giá trị hiện ngay khi nhập. */
export function isMissingError(msg: string): boolean {
  return msg === MSG.projectRequired || msg === MSG.titleRequired || msg === MSG.creatorRequired;
}

export function isTooLarge(sizeBytes: number): boolean {
  return sizeBytes > FILE_MAX_BYTES;
}

export function fileTooLargeMessage(name: string): string {
  return `Tệp “${name}” vượt quá 50 MB.`;
}
