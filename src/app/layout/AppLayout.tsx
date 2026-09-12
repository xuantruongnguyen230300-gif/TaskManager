import { Outlet } from "@tanstack/react-router";
import { ProjectDialog } from "@/features/projects/ProjectDialog";
import { TaskDetailPanel } from "@/features/task-detail/TaskDetailPanel";
import { TaskFormDialog } from "@/features/task-form/TaskFormDialog";
import { useTaskPanel } from "@/shared/hooks/use-task-panel";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { TopBar } from "./TopBar";

/**
 * Khung chung: thanh tiêu đề tự vẽ · Sidebar 224px · thanh trên · vùng nội dung tự cuộn.
 * Hộp thoại/panel toàn cục: Chi tiết việc (theo ?task=), form Tạo/Sửa việc, form Dự án (theo store).
 */
export function AppLayout() {
  const { taskId, closeTask } = useTaskPanel();

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <TitleBar />
      <div className="flex min-h-0 flex-1 gap-3.5 px-3.5 pb-3.5">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col gap-3.5">
          <TopBar />
          {/* Mỗi màn tự cuộn trong vùng này; sidebar và thanh trên đứng yên. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <TaskDetailPanel taskId={taskId} onClose={closeTask} />
      <TaskFormDialog />
      <ProjectDialog />
    </div>
  );
}
