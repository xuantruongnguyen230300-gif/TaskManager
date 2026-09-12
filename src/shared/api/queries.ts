/**
 * Hook đọc dùng chung nhiều feature (sidebar, dropdown, bộ lọc).
 * Hook riêng của một feature (useTasks, useDashboard…) đặt trong thư mục feature đó.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "./commands";
import { queryKeys } from "./query-keys";
import type { EmployeeStatusFilter } from "./types";

/** Mọi dự án kèm tiến độ, sắp theo id (Việc chung đầu tiên). */
export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: api.listProjects });
}

/** Nhân viên theo trạng thái. Dropdown chọn người dùng `useEmployees("all")` rồi lọc phía client. */
export function useEmployees(status: EmployeeStatusFilter = "all") {
  const input = { status };
  return useQuery({
    queryKey: queryKeys.employeeList(input),
    queryFn: () => api.listEmployees(input),
  });
}

/** Cài đặt: theme, thư mục dữ liệu, id hồ sơ "Tôi" (`selfEmployeeId`). */
export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: api.getSettings });
}
