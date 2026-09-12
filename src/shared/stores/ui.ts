/**
 * Trạng thái UI toàn cục nhỏ (zustand): mở form Tạo/Sửa việc (SC-4) và form Dự án từ bất kỳ đâu.
 * Panel Chi tiết việc (SC-5) KHÔNG ở đây — nó theo URL `?task=<id>` (xem shared/hooks/use-task-panel).
 */
import { create } from "zustand";
import type { Id, TaskStatus } from "@/shared/api/types";

/** Giá trị điền sẵn khi tạo việc (ví dụ "+ Thêm việc" ở cột Kanban: dự án + trạng thái của cột). */
export interface TaskFormDefaults {
  projectId?: Id;
  status?: TaskStatus;
  assigneeId?: Id | null;
}

export type TaskFormState =
  | { open: false }
  | { open: true; mode: "create"; defaults: TaskFormDefaults }
  | { open: true; mode: "edit"; taskId: Id };

/** projectId null = tạo dự án mới. */
export type ProjectDialogState = { open: false } | { open: true; projectId: Id | null };

interface UiState {
  taskForm: TaskFormState;
  projectDialog: ProjectDialogState;
  openCreateTask: (defaults?: TaskFormDefaults) => void;
  openEditTask: (taskId: Id) => void;
  closeTaskForm: () => void;
  openProjectDialog: (projectId?: Id | null) => void;
  closeProjectDialog: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  taskForm: { open: false },
  projectDialog: { open: false },
  openCreateTask: (defaults = {}) => set({ taskForm: { open: true, mode: "create", defaults } }),
  openEditTask: (taskId) => set({ taskForm: { open: true, mode: "edit", taskId } }),
  closeTaskForm: () => set({ taskForm: { open: false } }),
  openProjectDialog: (projectId = null) => set({ projectDialog: { open: true, projectId } }),
  closeProjectDialog: () => set({ projectDialog: { open: false } }),
}));
