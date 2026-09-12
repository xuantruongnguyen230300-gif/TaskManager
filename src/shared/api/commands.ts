/**
 * Hàm gọi command có kiểu — bọc `invoke` của Tauri, lỗi luôn ném `AppError`.
 * Tên command = tên hàm Rust (snake_case). Khoá tham số: `id`, `input`, `filter`.
 * Feature KHÔNG gọi `invoke` trực tiếp; luôn dùng `api.xxx`.
 */
import { invoke } from "@tauri-apps/api/core";
import { toAppError } from "./errors";
import type {
  AddAttachmentsInput,
  AddCommentInput,
  AddSubtaskInput,
  Attachment,
  BackupResult,
  Comment,
  CreateEmployeeInput,
  CreateProjectInput,
  CreateTaskInput,
  Dashboard,
  DeactivateEmployeeInput,
  DeactivateResult,
  EmployeeDetail,
  EmployeeRow,
  Id,
  ListEmployeesInput,
  PickedFile,
  ProjectSummary,
  SetTaskStatusInput,
  Settings,
  Subtask,
  TaskDetail,
  TaskFilter,
  TaskRow,
  TrashRow,
  UpdateEmployeeInput,
  UpdateProjectInput,
  UpdateSettingsInput,
  UpdateSubtaskInput,
  UpdateTaskInput,
} from "./types";

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw toAppError(e);
  }
}

export const api = {
  // Tổng quan
  getDashboard: () => call<Dashboard>("get_dashboard"),

  // Việc
  listTasks: (filter: TaskFilter = {}) => call<TaskRow[]>("list_tasks", { filter }),
  getTask: (id: Id) => call<TaskDetail>("get_task", { id }),
  createTask: (input: CreateTaskInput) => call<TaskDetail>("create_task", { input }),
  updateTask: (input: UpdateTaskInput) => call<TaskDetail>("update_task", { input }),
  setTaskStatus: (input: SetTaskStatusInput) => call<TaskDetail>("set_task_status", { input }),
  /** chuyển vào Thùng rác */
  deleteTask: (id: Id) => call<void>("delete_task", { id }),

  // Việc con
  addSubtask: (input: AddSubtaskInput) => call<Subtask>("add_subtask", { input }),
  updateSubtask: (input: UpdateSubtaskInput) => call<Subtask>("update_subtask", { input }),
  deleteSubtask: (id: Id) => call<void>("delete_subtask", { id }),

  // Bình luận
  addComment: (input: AddCommentInput) => call<Comment>("add_comment", { input }),
  deleteComment: (id: Id) => call<void>("delete_comment", { id }),

  // Tệp
  /** Rust mở hộp thoại chọn tệp; huỷ → [] */
  pickFiles: () => call<PickedFile[]>("pick_files"),
  addAttachments: (input: AddAttachmentsInput) => call<Attachment[]>("add_attachments", { input }),
  removeAttachment: (id: Id) => call<void>("remove_attachment", { id }),
  openAttachment: (id: Id) => call<void>("open_attachment", { id }),

  // Dự án
  listProjects: () => call<ProjectSummary[]>("list_projects"),
  createProject: (input: CreateProjectInput) => call<ProjectSummary>("create_project", { input }),
  updateProject: (input: UpdateProjectInput) => call<ProjectSummary>("update_project", { input }),
  deleteProject: (id: Id) => call<void>("delete_project", { id }),

  // Nhân viên
  listEmployees: (input: ListEmployeesInput) => call<EmployeeRow[]>("list_employees", { input }),
  getEmployee: (id: Id) => call<EmployeeDetail>("get_employee", { id }),
  createEmployee: (input: CreateEmployeeInput) =>
    call<EmployeeDetail>("create_employee", { input }),
  updateEmployee: (input: UpdateEmployeeInput) =>
    call<EmployeeDetail>("update_employee", { input }),
  deleteEmployee: (id: Id) => call<void>("delete_employee", { id }),
  deactivateEmployee: (input: DeactivateEmployeeInput) =>
    call<DeactivateResult>("deactivate_employee", { input }),
  reactivateEmployee: (id: Id) => call<void>("reactivate_employee", { id }),

  // Thùng rác
  listTrash: () => call<TrashRow[]>("list_trash"),
  restoreTask: (id: Id) => call<void>("restore_task", { id }),
  purgeTask: (id: Id) => call<void>("purge_task", { id }),
  emptyTrash: () => call<void>("empty_trash"),

  // Cài đặt
  getSettings: () => call<Settings>("get_settings"),
  updateSettings: (input: UpdateSettingsInput) => call<Settings>("update_settings", { input }),

  // Dữ liệu
  /** Rust mở hộp thoại lưu; huỷ → null */
  backupToZip: () => call<BackupResult | null>("backup_to_zip"),
  /** Rust mở hộp thoại chọn zip; huỷ → trả về bình thường; thành công → app khởi động lại */
  restoreFromZip: () => call<void>("restore_from_zip"),

  /** CHỈ BẢN DEBUG: nạp dữ liệu mẫu */
  devSeedSampleData: () => call<void>("dev_seed_sample_data"),
};
