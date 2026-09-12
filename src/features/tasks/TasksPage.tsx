import { getRouteApi } from "@tanstack/react-router";
import { format } from "date-fns";
import { Funnel, Search, X } from "lucide-react";
import { type ReactNode, useCallback, useDeferredValue, useMemo, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { useEmployees, useProjects } from "@/shared/api/queries";
import type { AssigneeFilter, DueFilter, TaskStatus } from "@/shared/api/types";
import { parseIsoDate } from "@/shared/lib/date";
import { OPEN_STATUSES, STATUS_ORDER, statusLabel } from "@/shared/lib/status";
import { Avatar, InactiveBadge } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { ProjectDot } from "@/shared/ui/project-dot";
import { StatusChip } from "@/shared/ui/status-chip";
import { FilterMenu, FilterOption } from "./FilterMenu";
import type { TasksSearch } from "./search";
import { TaskTable } from "./TaskTable";
import { filterTaskRows, weekBounds } from "./task-filters";
import { useAllTasks } from "./use-tasks";

const route = getRouteApi("/tasks");

const DUE_SHORT: Record<DueFilter, string> = {
  overdue: "Quá hạn",
  thisWeek: "Tuần này",
  noDue: "Không có hạn",
};

function toggled<T>(list: readonly T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** "A, B, C" — hơn 3 thì "A, B +n". */
function joinNames(names: string[]): string {
  return names.length > 3
    ? `${names.slice(0, 2).join(", ")} +${names.length - 2}`
    : names.join(", ");
}

/** SC-2 Công việc: ô tìm (đồng bộ ?q=) + lọc Dự án / Người phụ trách / Trạng thái / Hạn + bảng. */
export function TasksPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const tasks = useAllTasks();
  const projects = useProjects();
  const employees = useEmployees("all");

  const setSearch = useCallback(
    (patch: Partial<TasksSearch>) => {
      navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
    },
    [navigate],
  );

  // Ô tìm: giữ chữ đang gõ (kể cả khoảng trắng cuối), URL giữ bản đã cắt.
  const [text, setText] = useState(search.q ?? "");
  const [syncedQ, setSyncedQ] = useState(search.q);
  if (search.q !== syncedQ) {
    setSyncedQ(search.q);
    if ((search.q ?? "") !== text.trim()) setText(search.q ?? "");
  }
  const onText = (v: string) => {
    setText(v);
    setSearch({ q: v.trim() || undefined });
  };

  const statuses = search.statuses ?? OPEN_STATUSES;
  const all = tasks.data;
  const filtered = useMemo(
    () =>
      all
        ? filterTaskRows(all, {
            q: search.q,
            projects: search.projects,
            assignees: search.assignees,
            statuses: search.statuses,
            due: search.due,
          })
        : [],
    [all, search.q, search.projects, search.assignees, search.statuses, search.due],
  );
  const deferredRows = useDeferredValue(filtered);

  const projectById = useMemo(
    () => new Map((projects.data ?? []).map((p) => [p.id, p] as const)),
    [projects.data],
  );
  const employeeById = useMemo(
    () => new Map((employees.data ?? []).map((e) => [e.id, e] as const)),
    [employees.data],
  );

  const week = weekBounds();
  const weekLabel = `${format(parseIsoDate(week.monday), "dd/MM")} – ${format(parseIsoDate(week.sunday), "dd/MM")}`;

  const clearAll = () =>
    setSearch({
      q: undefined,
      projects: undefined,
      assignees: undefined,
      statuses: [],
      due: undefined,
    });

  const chips: { key: string; k: string; v: string; clear: () => void }[] = [];
  if (search.q) {
    chips.push({
      key: "q",
      k: "Tìm",
      v: `“${search.q}”`,
      clear: () => setSearch({ q: undefined }),
    });
  }
  if (search.projects) {
    const names = search.projects
      .map((id) => projectById.get(id)?.code)
      .filter((x): x is string => !!x);
    chips.push({
      key: "p",
      k: "Dự án",
      v: joinNames(names),
      clear: () => setSearch({ projects: undefined }),
    });
  }
  if (search.assignees) {
    const names = search.assignees
      .map((a) => (a === "unassigned" ? "Chưa giao" : employeeById.get(a)?.fullName))
      .filter((x): x is string => !!x);
    chips.push({
      key: "a",
      k: "Người phụ trách",
      v: joinNames(names),
      clear: () => setSearch({ assignees: undefined }),
    });
  }
  if (statuses.length) {
    chips.push({
      key: "s",
      k: "Trạng thái",
      v: joinNames(statuses.map(statusLabel)),
      clear: () => setSearch({ statuses: [] }),
    });
  }
  if (search.due) {
    chips.push({
      key: "d",
      k: "Hạn",
      v: DUE_SHORT[search.due],
      clear: () => setSearch({ due: undefined }),
    });
  }

  const setStatuses = (next: readonly TaskStatus[]) =>
    setSearch({ statuses: STATUS_ORDER.filter((s) => next.includes(s)) });

  let content: ReactNode;
  if (tasks.isError) {
    content = (
      <div className="rounded-card bg-surface px-5 py-[18px] text-sub shadow-card">
        {errorMessage(tasks.error)}
      </div>
    );
  } else if (tasks.isPending) {
    content = <TaskTable rows={[]} loading />;
  } else if (filtered.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-2.5 rounded-card bg-surface px-5 py-[72px] text-center shadow-card">
        <div className="flex size-[52px] items-center justify-center rounded-[18px] bg-surface2 text-muted">
          <Funnel className="size-[22px]" />
        </div>
        <div className="text-card-title">Không có việc nào khớp bộ lọc</div>
        <div className="text-sub">Bỏ bớt điều kiện lọc hoặc đổi từ khoá tìm kiếm.</div>
        <Button variant="secondary" size="sm" onClick={clearAll}>
          Xoá lọc
        </Button>
      </div>
    );
  } else {
    content = <TaskTable rows={deferredRows} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-none flex-col gap-[3px] px-1.5 pt-0.5">
        <h1 className="text-h1">Công việc</h1>
        <div className="text-sub">
          {all ? `${filtered.length} việc khớp bộ lọc · tổng ${all.length} việc` : "Đang tải…"}
        </div>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-2">
        <div className="relative w-[260px] flex-none">
          <Search className="pointer-events-none absolute top-[11px] left-[13px] size-[15px] text-muted" />
          <input
            value={text}
            onChange={(e) => onText(e.target.value)}
            placeholder="Tìm theo mã hoặc tiêu đề"
            aria-label="Tìm theo mã hoặc tiêu đề"
            className="h-9 w-full rounded-[18px] bg-surface pr-8 pl-9 font-bold text-[13.5px] text-ink shadow-[inset_0_0_0_1.5px_var(--line)] outline-none placeholder:font-semibold placeholder:text-muted focus-visible:shadow-[inset_0_0_0_2px_var(--barHot)] focus-visible:outline-none"
          />
          {text && (
            <button
              type="button"
              onClick={() => onText("")}
              title="Xoá từ khoá"
              aria-label="Xoá từ khoá"
              className="absolute top-[7px] right-[7px] flex size-[22px] items-center justify-center rounded-full bg-surface2 text-muted hover:text-ink"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <FilterMenu
          label="Dự án"
          head="Lọc theo dự án"
          width={250}
          count={search.projects?.length ?? 0}
        >
          {() =>
            projects.data?.map((p) => (
              <FilterOption
                key={p.id}
                mode="check"
                selected={!!search.projects?.includes(p.id)}
                onSelect={() => {
                  const next = toggled(search.projects ?? [], p.id);
                  setSearch({ projects: next.length ? next : undefined });
                }}
              >
                <ProjectDot color={p.color} />
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="text-code">{p.code}</span>
              </FilterOption>
            ))
          }
        </FilterMenu>

        <FilterMenu
          label="Người phụ trách"
          head="Lọc theo người phụ trách"
          width={250}
          count={search.assignees?.length ?? 0}
        >
          {() => {
            const pick = (a: AssigneeFilter) => {
              const next = toggled(search.assignees ?? [], a);
              setSearch({ assignees: next.length ? next : undefined });
            };
            return (
              <>
                <FilterOption
                  mode="check"
                  selected={!!search.assignees?.includes("unassigned")}
                  onSelect={() => pick("unassigned")}
                >
                  <Avatar name={null} className="size-[22px] text-[9.5px]" />
                  <span>Chưa giao</span>
                </FilterOption>
                {employees.data?.map((e) => (
                  <FilterOption
                    key={e.id}
                    mode="check"
                    selected={!!search.assignees?.includes(e.id)}
                    onSelect={() => pick(e.id)}
                  >
                    <Avatar
                      name={e.fullName}
                      color={e.color}
                      className="size-[22px] text-[9.5px]"
                    />
                    <span className="min-w-0 truncate">{e.fullName}</span>
                    {e.status === "inactive" && <InactiveBadge />}
                  </FilterOption>
                ))}
              </>
            );
          }}
        </FilterMenu>

        <FilterMenu
          label="Trạng thái"
          head="Lọc theo trạng thái (chọn nhiều)"
          width={230}
          count={statuses.length}
        >
          {() => (
            <>
              {STATUS_ORDER.map((s) => (
                <FilterOption
                  key={s}
                  mode="check"
                  selected={statuses.includes(s)}
                  onSelect={() => setStatuses(toggled(statuses, s))}
                >
                  <StatusChip status={s} />
                </FilterOption>
              ))}
              <div className="mt-1 flex gap-1.5 border-line border-t px-1.5 pt-2 pb-0.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-3 text-[12.5px]"
                  onClick={() => setSearch({ statuses: undefined })}
                >
                  Chỉ đang mở
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-3 text-[12.5px]"
                  onClick={() => setSearch({ statuses: [] })}
                >
                  Mọi trạng thái
                </Button>
              </div>
            </>
          )}
        </FilterMenu>

        <FilterMenu label="Hạn" head="Lọc theo hạn" width={240} count={search.due ? 1 : 0}>
          {(close) =>
            (
              [
                [undefined, "Tất cả"],
                ["overdue", "Quá hạn"],
                ["thisWeek", `Tuần này (${weekLabel})`],
                ["noDue", "Không có hạn"],
              ] as const
            ).map(([value, label]) => (
              <FilterOption
                key={label}
                mode="radio"
                selected={search.due === value}
                onSelect={() => {
                  setSearch({ due: value });
                  close();
                }}
              >
                <span>{label}</span>
              </FilterOption>
            ))
          }
        </FilterMenu>
      </div>

      <div className="flex h-8 flex-none items-center gap-2 overflow-hidden">
        {chips.map((c) => (
          <span
            key={c.key}
            className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-[14px] bg-surface pr-1 pl-3 font-bold text-[12.5px] text-ink2 shadow-[inset_0_0_0_1.5px_var(--line)]"
          >
            {c.k}: <b className="font-extrabold text-ink">{c.v}</b>
            <button
              type="button"
              onClick={c.clear}
              title="Bỏ điều kiện này"
              aria-label={`Bỏ lọc ${c.k}`}
              className="inline-flex size-[22px] items-center justify-center rounded-full text-muted hover:bg-surface2 hover:text-ink"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {chips.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 whitespace-nowrap font-extrabold text-[13px] text-hero-ink hover:underline"
          >
            Xoá lọc
          </button>
        ) : (
          <span className="whitespace-nowrap text-[12.5px] text-muted">
            Chưa áp dụng bộ lọc · đang hiện việc ở mọi trạng thái
          </span>
        )}
      </div>

      {content}
    </div>
  );
}
