/**
 * Đọc/ghi của SC-5. Sau mọi thao tác ghi: cập nhật ngay cache chi tiết (phản hồi tức thì)
 * rồi `invalidateTaskData` (bảng, Kanban, tổng quan, tiến độ dự án, số đếm nhân viên).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/commands";
import { invalidateTaskData, queryKeys } from "@/shared/api/query-keys";
import type { Id, Subtask, TaskDetail } from "@/shared/api/types";

export function useTaskDetail(id: Id) {
  return useQuery({ queryKey: queryKeys.task(id), queryFn: () => api.getTask(id) });
}

/** Sửa cache chi tiết của một việc + làm mới dữ liệu việc. */
function useTaskCache(taskId: Id) {
  const qc = useQueryClient();
  const key = queryKeys.task(taskId);
  return {
    qc,
    patch(fn: (d: TaskDetail) => TaskDetail): TaskDetail | undefined {
      const prev = qc.getQueryData<TaskDetail>(key);
      if (prev) qc.setQueryData(key, fn(prev));
      return prev;
    },
    restore(prev: TaskDetail | undefined) {
      if (prev) qc.setQueryData(key, prev);
    },
    cancel: () => qc.cancelQueries({ queryKey: key }),
    refresh() {
      void invalidateTaskData(qc);
    },
  };
}

/** Mutation trả về TaskDetail mới (đổi trạng thái, sửa ngày thực tế). */
function useDetailWrite<V>(fn: (v: V) => Promise<TaskDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (d) => {
      qc.setQueryData(queryKeys.task(d.id), d);
      void invalidateTaskData(qc);
    },
  });
}

export function useSetTaskStatus() {
  return useDetailWrite(api.setTaskStatus);
}

export function useUpdateTask() {
  return useDetailWrite(api.updateTask);
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTask,
    onSuccess: () => {
      void invalidateTaskData(qc);
    },
  });
}

export function useSubtaskActions(taskId: Id) {
  const c = useTaskCache(taskId);
  const add = useMutation({
    mutationFn: api.addSubtask,
    onSuccess: (s) => {
      c.patch((d) => ({ ...d, subtasks: [...d.subtasks, s] }));
      c.refresh();
    },
  });
  // Tick / xoá: cập nhật lạc quan, lỗi thì hoàn lại.
  const toggle = useMutation({
    mutationFn: (s: Subtask) => api.updateSubtask({ id: s.id, isDone: !s.isDone }),
    onMutate: async (s) => {
      await c.cancel();
      return c.patch((d) => ({
        ...d,
        subtasks: d.subtasks.map((x) => (x.id === s.id ? { ...x, isDone: !s.isDone } : x)),
      }));
    },
    onError: (_e, _s, prev) => c.restore(prev),
    onSettled: () => c.refresh(),
  });
  const remove = useMutation({
    mutationFn: (s: Subtask) => api.deleteSubtask(s.id),
    onMutate: async (s) => {
      await c.cancel();
      return c.patch((d) => ({ ...d, subtasks: d.subtasks.filter((x) => x.id !== s.id) }));
    },
    onError: (_e, _s, prev) => c.restore(prev),
    onSettled: () => c.refresh(),
  });
  return { add, toggle, remove };
}

export function useCommentActions(taskId: Id) {
  const c = useTaskCache(taskId);
  const add = useMutation({
    mutationFn: api.addComment,
    onSuccess: (cm) => {
      c.patch((d) => ({ ...d, comments: [...d.comments, cm] }));
      c.refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: Id) => api.deleteComment(id),
    onSuccess: (_v, id) => {
      c.patch((d) => ({ ...d, comments: d.comments.filter((x) => x.id !== id) }));
      c.refresh();
    },
  });
  return { add, remove };
}

export function useAttachmentActions(taskId: Id) {
  const c = useTaskCache(taskId);
  const open = useMutation({ mutationFn: (id: Id) => api.openAttachment(id) });
  const remove = useMutation({
    mutationFn: (id: Id) => api.removeAttachment(id),
    onSuccess: (_v, id) => {
      c.patch((d) => ({ ...d, attachments: d.attachments.filter((a) => a.id !== id) }));
      c.refresh();
    },
  });
  return { open, remove };
}
