import { Link } from "@tanstack/react-router";
import {
  Check,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Plus,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { useProjects } from "@/shared/api/queries";
import { useUiStore } from "@/shared/stores/ui";
import { ProjectDot } from "@/shared/ui/project-dot";

/** Link tự gắn data-status="active" khi đang ở route đó. */
const NAV_CLASS =
  "flex h-[38px] items-center gap-3 rounded-nav px-3.5 text-sm font-bold text-ink2 outline-none hover:bg-surface2 data-[status=active]:bg-btn data-[status=active]:text-btn-ink data-[status=active]:hover:bg-btn [&_svg]:size-[18px] [&_svg]:flex-none";

function NavItem({
  to,
  label,
  icon: Icon,
  exact = false,
}: {
  to: "/" | "/tasks" | "/employees" | "/trash" | "/settings";
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}) {
  return (
    <Link to={to} activeOptions={{ exact, includeSearch: false }} className={NAV_CLASS}>
      <Icon strokeWidth={2} />
      {label}
    </Link>
  );
}

/** Sidebar 224px: Tổng quan · Công việc · Nhân viên · DỰ ÁN (+ Dự án mới) · Thùng rác · Cài đặt. */
export function Sidebar() {
  const projects = useProjects();
  const openProjectDialog = useUiStore((s) => s.openProjectDialog);

  return (
    <nav className="flex w-56 flex-none flex-col gap-[3px] rounded-panel bg-surface px-3 py-4 shadow-card">
      <div className="flex items-center gap-2.5 px-2 pb-3">
        <div className="flex size-[30px] items-center justify-center rounded-[10px] bg-btn text-btn-ink">
          <Check className="size-4" strokeWidth={3} />
        </div>
        <div className="text-base font-extrabold">Quản lý Task</div>
      </div>

      <NavItem to="/" label="Tổng quan" icon={LayoutDashboard} exact />
      <NavItem to="/tasks" label="Công việc" icon={ListChecks} />
      <NavItem to="/employees" label="Nhân viên" icon={Users} />

      <div className="px-3.5 pt-3.5 pb-1 text-xs font-extrabold tracking-[0.04em] text-muted">
        DỰ ÁN
      </div>
      <div className="flex min-h-0 flex-col gap-[3px] overflow-y-auto">
        {projects.data?.map((p) => (
          <Link
            key={p.id}
            to="/projects/$projectId"
            params={{ projectId: p.id }}
            activeOptions={{ includeSearch: false }}
            className={NAV_CLASS}
            title={`${p.name} (${p.code})`}
          >
            <ProjectDot color={p.color} />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto text-[11px] font-extrabold tracking-[0.04em] text-muted in-data-[status=active]:text-inherit in-data-[status=active]:opacity-80">
              {p.code}
            </span>
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={() => openProjectDialog(null)}
        className={`${NAV_CLASS} text-muted`}
      >
        <Plus strokeWidth={2} />
        Dự án mới
      </button>

      <div className="mt-auto flex flex-col gap-[3px]">
        <NavItem to="/trash" label="Thùng rác" icon={Trash2} />
        <NavItem to="/settings" label="Cài đặt" icon={SlidersHorizontal} />
      </div>
    </nav>
  );
}
