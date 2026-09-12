import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/shared/api/commands";
import { errorMessage } from "@/shared/api/errors";
import { useEmployees, useProjects, useSettings } from "@/shared/api/queries";
import { queryKeys } from "@/shared/api/query-keys";
import { type TaskFormState, useUiStore } from "@/shared/stores/ui";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { draftForCreate, draftFromTask } from "./draft";
import { FormHeader, TaskForm } from "./TaskForm";

type OpenForm = Extract<TaskFormState, { open: true }>;

/**
 * SC-4 Form Tạo / Sửa việc (hộp thoại 760px, thân cuộn). Mở bằng `openCreateTask(defaults)` /
 * `openEditTask(taskId)` của `useUiStore`; layout luôn render, không props.
 */
export function TaskFormDialog() {
  const form = useUiStore((s) => s.taskForm);
  const close = useUiStore((s) => s.closeTaskForm);

  // Mỗi lần mở là một phiên mới (form khởi tạo lại); giữ phiên cuối để nội dung không
  // biến mất trong lúc hộp thoại chạy hiệu ứng đóng.
  const [session, setSession] = useState<{ key: number; state: OpenForm } | null>(null);
  if (form.open && session?.state !== form) {
    setSession({ key: (session?.key ?? 0) + 1, state: form });
  }

  return (
    <Dialog open={form.open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[calc(100vh-72px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]"
      >
        {session && <TaskFormSession key={session.key} state={session.state} onClose={close} />}
      </DialogContent>
    </Dialog>
  );
}

function TaskFormSession({ state, onClose }: { state: OpenForm; onClose: () => void }) {
  const editId = state.mode === "edit" ? state.taskId : null;
  const projects = useProjects();
  const employees = useEmployees("all");
  const settings = useSettings();
  const task = useQuery({
    queryKey: queryKeys.task(editId ?? 0),
    queryFn: () => api.getTask(editId ?? 0),
    enabled: editId !== null,
  });

  const heading =
    editId === null ? "Tạo việc mới" : task.data ? `Sửa ${task.data.code}` : "Sửa việc";

  if (!projects.data || !employees.data || settings.isPending || (editId !== null && !task.data)) {
    const error = projects.error ?? employees.error ?? (editId !== null ? task.error : null);
    return (
      <>
        <FormHeader heading={heading} />
        <div className="px-6 py-10 text-sub">{error ? errorMessage(error) : "Đang tải…"}</div>
        <div className="flex justify-end border-t px-6 py-3.5">
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
        </div>
      </>
    );
  }

  // "Tôi" = mặc định Người tạo; cài đặt chưa đọc được thì lấy hồ sơ isSelf.
  const selfId = settings.data?.selfEmployeeId ?? employees.data.find((e) => e.isSelf)?.id ?? null;
  const detail = editId !== null ? (task.data ?? null) : null;
  const initial = detail
    ? draftFromTask(detail)
    : draftForCreate(state.mode === "create" ? state.defaults : {}, projects.data, selfId);

  return (
    <TaskForm
      heading={heading}
      task={detail}
      initial={initial}
      projects={projects.data}
      onClose={onClose}
    />
  );
}
