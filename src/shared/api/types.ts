/**
 * HỢP ĐỒNG IPC (viết tay) — khớp 1-1 với `src-tauri/src/dto.rs`.
 * Đổi một kiểu thì sửa CẢ HAI file trong cùng thay đổi.
 *
 * Quy ước: thời điểm = ms UTC (`number`); ngày lịch = "YYYY-MM-DD" (`string`);
 * `T | null` = Rust `Option<T>`. Patch: trường không gửi = giữ nguyên, `null` = xoá giá trị.
 */

export type Id = number;

export type TaskStatus = "new" | "in_progress" | "waiting" | "done" | "cancelled";
/** 1 Thấp · 2 Trung bình · 3 Cao · 4 Khẩn cấp */
export type Priority = 1 | 2 | 3 | 4;
export type EmployeeStatus = "active" | "inactive";
export type EmployeeStatusFilter = "active" | "inactive" | "all";
export type Theme = "light" | "dark" | "system";
export type DueFilter = "overdue" | "thisWeek" | "noDue";
/** id nhân viên hoặc "unassigned" (Chưa giao) */
export type AssigneeFilter = Id | "unassigned";

export type HistoryField =
  | "created"
  | "title"
  | "description"
  | "project"
  | "status"
  | "priority"
  | "assignee"
  | "creator"
  | "start_date"
  | "due_date"
  | "actual_start"
  | "actual_end"
  | "attachment_added"
  | "attachment_removed"
  | "deleted"
  | "restored";

// ======================= Nhân viên =======================

export interface EmployeeRow {
  id: Id;
  fullName: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  color: string;
  isSelf: boolean;
  status: EmployeeStatus;
  openCount: number;
  overdueCount: number;
}

export interface EmployeeDetail {
  id: Id;
  fullName: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  color: string;
  isSelf: boolean;
  status: EmployeeStatus;
  createdAt: number;
  updatedAt: number;
  openCount: number;
  overdueCount: number;
  done30dCount: number;
}

export interface ListEmployeesInput {
  status: EmployeeStatusFilter;
  q?: string | null;
}

export interface CreateEmployeeInput {
  fullName: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  color: string;
}

export interface UpdateEmployeeInput extends CreateEmployeeInput {
  id: Id;
}

export interface DeactivateEmployeeInput {
  id: Id;
  /** null = để "Chưa giao" */
  reassignTo: Id | null;
}

export interface DeactivateResult {
  reassignedCount: number;
}

// ======================= Dự án =======================

export interface ProjectSummary {
  id: Id;
  code: string;
  name: string;
  color: string;
  /** x: số việc Hoàn thành */
  doneCount: number;
  /** y: tổng việc − Đã huỷ (0 → hiện "—") */
  progressTotal: number;
  /** có việc (kể cả Thùng rác) → khoá ô Mã, không xoá được */
  hasTasks: boolean;
  /** "Việc chung" (id 1), không xoá được */
  isDefault: boolean;
  /** số của mã việc kế tiếp (form SC-4 hiện "Mã dự kiến"); 0 = chưa có → ẩn */
  nextTaskNo: number;
}

export interface CreateProjectInput {
  name: string;
  code: string;
  color: string;
}

export interface UpdateProjectInput extends CreateProjectInput {
  id: Id;
}

// ======================= Việc =======================

/** Bỏ trống = không lọc; riêng `statuses` bỏ trống = Mới + Đang làm + Đang chờ. */
export interface TaskFilter {
  projectId?: Id | null;
  assignee?: AssigneeFilter | null;
  statuses?: TaskStatus[] | null;
  due?: DueFilter | null;
  q?: string | null;
}

export interface TaskRow {
  id: Id;
  code: string;
  title: string;
  projectId: Id;
  projectCode: string;
  projectName: string;
  projectColor: string;
  assigneeId: Id | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  assigneeInactive: boolean;
  creatorId: Id;
  creatorName: string;
  status: TaskStatus;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  createdAt: number;
  /** Kết thúc thực tế (ms), SC-7 tab Đã hoàn thành */
  actualEndAt?: number | null;
  subtaskDone: number;
  subtaskTotal: number;
  commentCount: number;
  attachmentCount: number;
}

export interface TaskInfo {
  id: Id;
  code: string;
  projectId: Id;
  projectCode: string;
  projectName: string;
  projectColor: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  statusNote: string | null;
  priority: Priority;
  assigneeId: Id | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  assigneeInactive: boolean;
  creatorId: Id;
  creatorName: string;
  creatorColor: string;
  creatorInactive: boolean;
  startDate: string | null;
  dueDate: string | null;
  actualStartAt: number | null;
  actualEndAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Subtask {
  id: Id;
  taskId: Id;
  title: string;
  isDone: boolean;
  position: number;
}

export interface Comment {
  id: Id;
  taskId: Id;
  authorId: Id;
  authorName: string;
  authorColor: string;
  authorInactive: boolean;
  body: string;
  createdAt: number;
}

export interface Attachment {
  id: Id;
  taskId: Id;
  fileName: string;
  sizeBytes: number;
  createdAt: number;
}

/** oldValue/newValue là chữ hiển thị sẵn; null → hiện "(trống)". */
export interface HistoryEntry {
  id: Id;
  changedAt: number;
  field: HistoryField;
  oldValue: string | null;
  newValue: string | null;
}

export interface TaskDetail extends TaskInfo {
  /** theo position tăng dần */
  subtasks: Subtask[];
  /** cũ nhất trước */
  comments: Comment[];
  attachments: Attachment[];
  /** mới nhất trước */
  history: HistoryEntry[];
}

export interface CreateTaskInput {
  projectId: Id;
  title: string;
  description?: string | null;
  assigneeId?: Id | null;
  creatorId: Id;
  status: TaskStatus;
  statusNote?: string | null;
  priority: Priority;
  startDate?: string | null;
  dueDate?: string | null;
  /** tiêu đề việc con theo thứ tự; dòng trống bị bỏ */
  subtasks?: string[];
  /** đường dẫn lấy từ pickFiles() */
  filePaths?: string[];
}

/** id có = dòng cũ (giữ trạng thái tick), không có = dòng mới */
export interface SubtaskDraft {
  id?: Id | null;
  title: string;
}

/** Trường không gửi = giữ nguyên; `null` = xoá giá trị. */
export interface TaskPatch {
  projectId?: Id;
  title?: string;
  description?: string | null;
  assigneeId?: Id | null;
  creatorId?: Id;
  status?: TaskStatus;
  statusNote?: string | null;
  priority?: Priority;
  startDate?: string | null;
  dueDate?: string | null;
  actualStartAt?: number | null;
  actualEndAt?: number | null;
  /** danh sách ĐẦY ĐỦ theo thứ tự mới */
  subtasks?: SubtaskDraft[];
  addFilePaths?: string[];
  removeAttachmentIds?: Id[];
}

export interface UpdateTaskInput {
  id: Id;
  patch: TaskPatch;
}

export interface SetTaskStatusInput {
  id: Id;
  status: TaskStatus;
  /** lý do chờ/huỷ */
  note?: string | null;
}

// ======================= Việc con · Bình luận · Tệp =======================

export interface AddSubtaskInput {
  taskId: Id;
  title: string;
}

export interface UpdateSubtaskInput {
  id: Id;
  title?: string | null;
  isDone?: boolean | null;
}

export interface AddCommentInput {
  taskId: Id;
  authorId: Id;
  body: string;
}

export interface PickedFile {
  path: string;
  fileName: string;
  sizeBytes: number;
}

export interface AddAttachmentsInput {
  taskId: Id;
  filePaths: string[];
}

// ======================= Tổng quan =======================

export interface EmployeeWorkload {
  id: Id;
  fullName: string;
  color: string;
  isSelf: boolean;
  openCount: number;
  overdueCount: number;
}

export interface Dashboard {
  openCount: number;
  overdueCount: number;
  waitingCount: number;
  doneThisWeekCount: number;
  /** đang mở, hạn ≤ ngày mai, sắp theo hạn tăng dần */
  attention: TaskRow[];
  /** nhân viên đang làm việc, sắp số việc đang mở giảm dần */
  byEmployee: EmployeeWorkload[];
}

// ======================= Thùng rác =======================

export interface TrashRow {
  id: Id;
  code: string;
  title: string;
  projectId: Id;
  projectCode: string;
  projectName: string;
  projectColor: string;
  deletedAt: number;
  /** "Còn N ngày" */
  daysLeft: number;
}

// ======================= Cài đặt · Dữ liệu =======================

export interface Settings {
  theme: Theme;
  dataDir: string;
  selfEmployeeId: Id;
}

export interface UpdateSettingsInput {
  theme: Theme;
}

export interface BackupResult {
  path: string;
}
