import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/commands";
import { invalidateTaskData, queryKeys } from "@/shared/api/query-keys";
import type { SetTaskStatusInput, TaskFilter, TaskRow } from "@/shared/api/types";

/**
 * Kéo thẻ Kanban = `set_task_status`, cập nhật lạc quan danh sách của bảng (`taskList(filter)`).
 * Lỗi → hoàn lại danh sách cũ (toast lỗi do MutationCache tự hiện).
 */
export function useSetTaskStatus(filter: TaskFilter) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetTaskStatusInput) => api.setTaskStatus(input),
    onMutate: async (input) => {
      const key = queryKeys.taskList(filter);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskRow[]>(key);
      qc.setQueryData<TaskRow[]>(key, (old) =>
        old?.map((t) => (t.id === input.id ? { ...t, status: input.status } : t)),
      );
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.taskList(filter), ctx.prev);
    },
    onSettled: () => invalidateTaskData(qc),
  });
}
