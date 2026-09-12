/**
 * Khoá TanStack Query dùng chung + hàm invalidate sau mutation (không có event từ Rust).
 * `staleTime: Infinity` → dữ liệu chỉ làm mới khi invalidate.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { Id, ListEmployeesInput, TaskFilter } from "./types";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  /** gốc của mọi danh sách việc */
  tasks: ["tasks"] as const,
  taskList: (filter: TaskFilter) => ["tasks", filter] as const,
  /** gốc chi tiết việc */
  taskDetails: ["task"] as const,
  task: (id: Id) => ["task", id] as const,
  projects: ["projects"] as const,
  /** gốc của mọi truy vấn nhân viên (danh sách + chi tiết) */
  employees: ["employees"] as const,
  employeeList: (input: ListEmployeesInput) => ["employees", "list", input] as const,
  employee: (id: Id) => ["employees", "detail", id] as const,
  trash: ["trash"] as const,
  settings: ["settings"] as const,
};

function invalidate(qc: QueryClient, keys: ReadonlyArray<readonly unknown[]>) {
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

/**
 * Sau MỌI thao tác ghi liên quan đến việc (tạo/sửa/đổi trạng thái/xoá/khôi phục, việc con,
 * bình luận, tệp): danh sách việc, chi tiết, tổng quan, tiến độ dự án, số đếm nhân viên, thùng rác.
 */
export function invalidateTaskData(qc: QueryClient) {
  return invalidate(qc, [
    queryKeys.tasks,
    queryKeys.taskDetails,
    queryKeys.dashboard,
    queryKeys.projects,
    queryKeys.employees,
    queryKeys.trash,
  ]);
}

/** Sau tạo/sửa/xoá dự án (tên, mã, màu hiện trong dòng việc). */
export function invalidateProjectData(qc: QueryClient) {
  return invalidate(qc, [
    queryKeys.projects,
    queryKeys.tasks,
    queryKeys.taskDetails,
    queryKeys.trash,
  ]);
}

/** Sau tạo/sửa/xoá/chuyển trạng thái nhân viên (tên, màu, giao lại việc). */
export function invalidateEmployeeData(qc: QueryClient) {
  return invalidate(qc, [
    queryKeys.employees,
    queryKeys.tasks,
    queryKeys.taskDetails,
    queryKeys.dashboard,
    queryKeys.settings,
  ]);
}
