import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { List, Pencil, SquareKanban, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { TaskTable } from "@/features/tasks/TaskTable";
import { api } from "@/shared/api/commands";
import { errorMessage } from "@/shared/api/errors";
import { useProjects } from "@/shared/api/queries";
import { invalidateProjectData } from "@/shared/api/query-keys";
import type { ProjectSummary, TaskRow } from "@/shared/api/types";
import { useTaskPanel } from "@/shared/hooks/use-task-panel";
import { progressLabel } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/stores/ui";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { ProjectDot } from "@/shared/ui/project-dot";
import { toast } from "@/shared/ui/sonner";
import { AssigneeFilter, type AssigneeKey, assigneeKey } from "./AssigneeFilter";
import { KanbanBoard } from "./kanban/KanbanBoard";
import { projectTaskFilter, useProjectTasks } from "./use-project-tasks";

const route = getRouteApi("/projects/$projectId");
const NO_ROWS: TaskRow[] = [];

/** SC-3 Dự án: đầu trang (tiến độ, Sửa/Xoá) · lọc người phụ trách · Kanban | Danh sách. */
export function ProjectPage() {
  const { projectId } = route.useParams();
  const projects = useProjects();
  const project = projects.data?.find((p) => p.id === projectId);
  if (projects.isPending) return null;
  if (projects.isError) return <div className="p-6 text-sub">{errorMessage(projects.error)}</div>;
  if (!project) return <div className="p-6 text-sub">Không tìm thấy dự án.</div>;
  // key: đổi dự án thì bỏ bộ lọc người phụ trách, trạng thái cột.
  return <ProjectView key={project.id} project={project} />;
}

function ProjectView({ project }: { project: ProjectSummary }) {
  const isList = route.useSearch().view === "list";
  const navigate = route.useNavigate();
  const { openTask } = useTaskPanel();
  const filter = useMemo(() => projectTaskFilter(project.id), [project.id]);
  const tasks = useProjectTasks(filter);
  const rows = tasks.data ?? NO_ROWS;
  const [selected, setSelected] = useState<AssigneeKey[]>([]);
  const visible = useMemo(
    () => (selected.length === 0 ? rows : rows.filter((r) => selected.includes(assigneeKey(r)))),
    [rows, selected],
  );

  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState(false);
  const del = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      setConfirmDel(false);
      toast.success(`Đã xoá dự án ${project.name}`);
      navigate({ to: "/" });
      invalidateProjectData(qc);
    },
    onError: () => setConfirmDel(false),
  });

  // R-02: chặn trước bằng toast đúng câu 02 §9; backend vẫn kiểm tra lại.
  const onDelete = () => {
    if (project.isDefault) toast.error("Không thể xoá dự án Việc chung.");
    else if (project.hasTasks)
      toast.error("Chỉ xoá được dự án không còn việc nào (kể cả trong Thùng rác).");
    else setConfirmDel(true);
  };

  const setView = (list: boolean) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, view: list ? "list" : undefined }) });

  const pct =
    project.progressTotal > 0 ? Math.round((project.doneCount / project.progressTotal) * 100) : 0;
  let progText = "";
  if (tasks.isSuccess) {
    const cancelled = rows.filter((r) => r.status === "cancelled").length;
    progText =
      rows.length === 0
        ? "Dự án chưa có việc nào"
        : `việc hoàn thành · không tính ${cancelled} việc đã huỷ`;
  }

  let body: ReactNode = null;
  if (tasks.isError) {
    body = (
      <div className="rounded-card bg-surface px-5 py-[18px] text-sub shadow-card">
        {errorMessage(tasks.error)}
      </div>
    );
  } else if (isList) {
    body = (
      <div className="rounded-card bg-surface px-1.5 pb-1.5 shadow-card">
        <TaskTable
          rows={visible}
          hiddenColumns={["project"]}
          loading={tasks.isPending}
          emptyText={
            selected.length > 0
              ? "Không có việc nào của người đang lọc."
              : "Dự án chưa có việc nào."
          }
        />
      </div>
    );
  } else if (tasks.isSuccess) {
    body = (
      <KanbanBoard
        projectId={project.id}
        filter={filter}
        rows={visible}
        filtered={selected.length > 0}
        onOpenTask={openTask}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3.5", !isList && "min-h-0 flex-1")}>
      <div className="flex flex-none flex-col gap-3 rounded-card bg-surface px-5 py-4 shadow-card">
        <div className="flex items-center gap-3">
          <ProjectDot color={project.color} className="size-[18px] rounded-[6px]" />
          <span className="text-[13px] font-extrabold tracking-[0.02em] text-muted">
            {project.code}
          </span>
          <h1 className="min-w-0 truncate text-2xl leading-[1.15] font-extrabold tracking-[-0.01em]">
            {project.name}
          </h1>
          <ViewSwitch isList={isList} onChange={setView} />
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-[170px] rounded bg-pill">
              <div
                className="h-2 rounded"
                style={{ width: `${pct}%`, background: project.color }}
              />
            </div>
            <span className="text-[15px] font-extrabold">
              {progressLabel(project.doneCount, project.progressTotal)}
            </span>
            <span className="text-[12.5px] font-semibold text-muted">{progText}</span>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => useUiStore.getState().openProjectDialog(project.id)}
            >
              <Pencil />
              Sửa dự án
            </Button>
            <Button variant="outline" size="sm" className="text-danger" onClick={onDelete}>
              <Trash2 />
              Xoá dự án
            </Button>
          </div>
        </div>
      </div>

      <AssigneeFilter rows={rows} selected={selected} onChange={setSelected} />
      {body}

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`Xoá dự án “${project.name}”?`}
        description="Dự án sẽ bị xoá hẳn."
        confirmLabel="Xoá dự án"
        pending={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}

const SEG_ITEM =
  "flex h-[30px] items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-extrabold [&_svg]:size-[15px]";

/** Nút phân đoạn Danh sách | Kanban (đổi `?view=`). */
function ViewSwitch({ isList, onChange }: { isList: boolean; onChange: (list: boolean) => void }) {
  const item = (on: boolean) =>
    cn(
      SEG_ITEM,
      on ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-muted hover:text-ink",
    );
  return (
    <fieldset className="ml-auto inline-flex flex-none gap-1 rounded-[14px] border-0 bg-surface2 p-1">
      <legend className="sr-only">Chế độ xem</legend>
      <button
        type="button"
        aria-pressed={isList}
        className={item(isList)}
        onClick={() => onChange(true)}
      >
        <List aria-hidden="true" />
        Danh sách
      </button>
      <button
        type="button"
        aria-pressed={!isList}
        className={item(!isList)}
        onClick={() => onChange(false)}
      >
        <SquareKanban aria-hidden="true" />
        Kanban
      </button>
    </fieldset>
  );
}
