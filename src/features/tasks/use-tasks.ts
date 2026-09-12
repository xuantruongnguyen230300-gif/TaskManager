import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/commands";
import { queryKeys } from "@/shared/api/query-keys";
import type { TaskFilter } from "@/shared/api/types";
import { STATUS_ORDER } from "@/shared/lib/status";

/** Mọi việc chưa xoá (đủ 5 trạng thái) — SC-2 lọc/sắp tại chỗ. */
const ALL_TASKS: TaskFilter = { statuses: [...STATUS_ORDER] };

export function useAllTasks() {
  return useQuery({
    queryKey: queryKeys.taskList(ALL_TASKS),
    queryFn: () => api.listTasks(ALL_TASKS),
  });
}
