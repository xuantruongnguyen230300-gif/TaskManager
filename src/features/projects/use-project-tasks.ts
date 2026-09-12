import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/commands";
import { queryKeys } from "@/shared/api/query-keys";
import type { Id, TaskFilter } from "@/shared/api/types";
import { STATUS_ORDER } from "@/shared/lib/status";

/** SC-3: mọi trạng thái của một dự án — Kanban và Danh sách dùng chung MỘT truy vấn. */
export function projectTaskFilter(projectId: Id): TaskFilter {
  return { projectId, statuses: [...STATUS_ORDER] };
}

export function useProjectTasks(filter: TaskFilter) {
  return useQuery({ queryKey: queryKeys.taskList(filter), queryFn: () => api.listTasks(filter) });
}
