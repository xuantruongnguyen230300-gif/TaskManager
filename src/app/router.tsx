/**
 * Định tuyến code-based (TanStack Router, không cần generator). Route chỉ ghép component trang
 * của feature. Search params của từng màn do feature định nghĩa (features/x/search.ts) để
 * agent sửa feature không phải đụng file này.
 *
 * `?task=<id>` hợp lệ ở MỌI route (root search) → mở panel Chi tiết việc (SC-5).
 */
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { EmployeeDetailPage } from "@/features/employees/EmployeeDetailPage";
import { EmployeesPage } from "@/features/employees/EmployeesPage";
import { ProjectPage } from "@/features/projects/ProjectPage";
import { validateProjectSearch } from "@/features/projects/search";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { validateTasksSearch } from "@/features/tasks/search";
import { TasksPage } from "@/features/tasks/TasksPage";
import { TrashPage } from "@/features/trash/TrashPage";
import { AppLayout } from "./layout/AppLayout";
import { RouteError } from "./layout/RouteError";

export interface RootSearch {
  /** id việc đang mở ở panel Chi tiết việc */
  task?: number;
}

function toId(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

const idParams = <K extends string>(key: K) => ({
  parse: (p: Record<K, string>) => ({ [key]: toId(p[key]) ?? 0 }) as Record<K, number>,
  stringify: (p: Record<K, number>) => ({ [key]: String(p[key]) }) as Record<K, string>,
});

const rootRoute = createRootRoute({
  validateSearch: (search: Record<string, unknown>): RootSearch => {
    const task = toId(search.task);
    return task ? { task } : {};
  },
  component: AppLayout,
});

/** SC-1 Tổng quan */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

/** SC-2 Công việc (?q=) */
const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tasks",
  validateSearch: validateTasksSearch,
  component: TasksPage,
});

/** SC-3 Dự án (?view=kanban|list) */
const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  params: idParams("projectId"),
  validateSearch: validateProjectSearch,
  component: ProjectPage,
});

/** SC-6 Nhân viên */
const employeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/employees",
  component: EmployeesPage,
});

/** SC-7 Chi tiết nhân viên */
const employeeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/employees/$employeeId",
  params: idParams("employeeId"),
  component: EmployeeDetailPage,
});

/** SC-8 Thùng rác */
const trashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trash",
  component: TrashPage,
});

/** SC-9 Cài đặt */
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  tasksRoute,
  projectRoute,
  employeesRoute,
  employeeRoute,
  trashRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: () => <div className="p-6 text-sub">Không tìm thấy trang.</div>,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
