import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/commands";
import { invalidateEmployeeData, queryKeys } from "@/shared/api/query-keys";
import type { CreateEmployeeInput, Id, TaskFilter, UpdateEmployeeInput } from "@/shared/api/types";
import { toast } from "@/shared/ui/sonner";

export function useEmployee(id: Id) {
  return useQuery({ queryKey: queryKeys.employee(id), queryFn: () => api.getEmployee(id) });
}

/** Việc của một người (SC-7, hộp Chuyển sang Đã nghỉ). */
export function useEmployeeTasks(filter: TaskFilter, enabled = true) {
  return useQuery({
    queryKey: queryKeys.taskList(filter),
    queryFn: () => api.listTasks(filter),
    enabled,
  });
}

/** Thêm (không có id) hoặc sửa (có id) nhân viên. Toast do nơi gọi hiện. */
export function useSaveEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput | UpdateEmployeeInput) =>
      "id" in input ? api.updateEmployee(input) : api.createEmployee(input),
    onSuccess: () => invalidateEmployeeData(qc),
  });
}

/** Xoá — lỗi tự xử lý (EMPLOYEE_IN_USE → hộp "Không thể xoá {họ tên}"). */
export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => api.deleteEmployee(id),
    meta: { silentError: true },
    onSuccess: () => invalidateEmployeeData(qc),
  });
}

/** R-04: chuyển sang Đã nghỉ, giao tất cả việc chưa xong cho `reassignTo` (null = Chưa giao). */
export function useDeactivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: Id; fullName: string; reassignTo: Id | null }) =>
      api.deactivateEmployee({ id, reassignTo }),
    onSuccess: (res, { fullName }) => {
      toast.success(`Đã chuyển ${fullName} sang Đã nghỉ. Đã giao lại ${res.reassignedCount} việc.`);
      return invalidateEmployeeData(qc);
    },
  });
}

/** "Làm việc lại" — không cần xác nhận. */
export function useReactivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: Id; fullName: string }) => api.reactivateEmployee(id),
    onSuccess: (_d, { fullName }) => {
      toast.success(`Đã chuyển ${fullName} về Đang làm việc`);
      return invalidateEmployeeData(qc);
    },
  });
}
