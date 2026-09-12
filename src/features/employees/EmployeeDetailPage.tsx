import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronRight, Mail, Pencil, Phone, Undo2 } from "lucide-react";
import { useState } from "react";
import { TaskTable } from "@/features/tasks/TaskTable";
import { errorMessage } from "@/shared/api/errors";
import type { EmployeeDetail } from "@/shared/api/types";
import { cn } from "@/shared/lib/utils";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { DeactivateDialog } from "./DeactivateDialog";
import { EmployeeDialog } from "./EmployeeDialog";
import { EmployeeStatusChip, SelfChip } from "./EmployeeStatusChip";
import { useEmployee, useEmployeeTasks, useReactivateEmployee } from "./use-employees";

const route = getRouteApi("/employees/$employeeId");
const INFO =
  "flex items-center gap-1.5 text-[12.5px] font-semibold text-ink2 [&_svg]:size-[15px] [&_svg]:text-muted";

/** SC-7 Chi tiết nhân viên. */
export function EmployeeDetailPage() {
  const { employeeId } = route.useParams();
  const q = useEmployee(employeeId);
  if (q.isPending) return null;
  if (q.isError) return <div className="p-6 text-sub">{errorMessage(q.error)}</div>;
  return <EmployeeView key={q.data.id} employee={q.data} />;
}

function EmployeeView({ employee: e }: { employee: EmployeeDetail }) {
  const [tab, setTab] = useState<"open" | "done">("open");
  const [editOpen, setEditOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const openTasks = useEmployeeTasks({ assignee: e.id });
  const doneTasks = useEmployeeTasks({ assignee: e.id, statuses: ["done"] });
  const reactivate = useReactivateEmployee();
  const inactive = e.status === "inactive";
  const current = tab === "open" ? openTasks : doneTasks;

  const kpis = [
    { label: "ĐANG MỞ", value: e.openCount, note: "Mới, Đang làm, Đang chờ", hot: false },
    {
      label: "QUÁ HẠN",
      value: e.overdueCount,
      note: "Việc đang mở có hạn chót trước hôm nay",
      hot: e.overdueCount > 0,
    },
    {
      label: "HOÀN THÀNH 30 NGÀY",
      value: e.done30dCount,
      note: "Việc Hoàn thành trong 30 ngày qua, theo Kết thúc thực tế",
      hot: false,
    },
  ];
  const tabs = [
    { key: "open" as const, label: "Đang phụ trách", count: openTasks.data?.length ?? e.openCount },
    { key: "done" as const, label: "Đã hoàn thành", count: doneTasks.data?.length },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <nav className="flex flex-none items-center gap-2 px-1.5 text-sm font-bold text-muted">
        <Link to="/employees" className="hover:text-ink">
          Nhân viên
        </Link>
        <ChevronRight className="size-[15px]" aria-hidden="true" />
        <span className="flex min-w-0 items-center gap-2 text-ink">
          <Avatar name={e.fullName} color={e.color} />
          <span className="truncate">{e.fullName}</span>
        </span>
      </nav>

      <div className="flex flex-none items-start gap-[18px] rounded-card bg-surface px-[22px] py-5 shadow-card">
        <Avatar name={e.fullName} color={e.color} className="size-16 text-[22px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1">{e.fullName}</h1>
            {e.isSelf && <SelfChip />}
            <EmployeeStatusChip status={e.status} />
          </div>
          {e.title && <div className="text-sm font-bold text-ink2">{e.title}</div>}
          {(e.phone || e.email) && (
            <div className="flex flex-wrap gap-5">
              {e.phone && (
                <span className={INFO}>
                  <Phone aria-hidden="true" />
                  {e.phone}
                </span>
              )}
              {e.email && (
                <span className={INFO}>
                  <Mail aria-hidden="true" />
                  {e.email}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-none flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-[15px]" />
              Sửa thông tin
            </Button>
            {!e.isSelf && !inactive && (
              <Button variant="outline" onClick={() => setRetireOpen(true)}>
                Chuyển sang Đã nghỉ
              </Button>
            )}
            {inactive && (
              <Button
                variant="outline"
                disabled={reactivate.isPending}
                onClick={() => reactivate.mutate({ id: e.id, fullName: e.fullName })}
              >
                <Undo2 className="size-[15px]" />
                Làm việc lại
              </Button>
            )}
          </div>
          {e.isSelf && (
            <span className="max-w-[300px] text-right text-[12.5px] leading-[1.4] font-semibold text-muted">
              Đây là hồ sơ của bạn (Tôi): không chuyển sang Đã nghỉ và không xoá được.
            </span>
          )}
        </div>
      </div>

      <div className="grid flex-none grid-cols-3 gap-3.5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex flex-col gap-1 rounded-card bg-surface px-5 py-4 shadow-card"
          >
            <span className="text-label">{k.label}</span>
            <b className={cn("num text-[28px] leading-[1.15]", k.hot ? "text-danger" : "text-ink")}>
              {k.value}
            </b>
            <span className="text-[12.5px] font-semibold text-muted">{k.note}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-none flex-col gap-2.5 rounded-card bg-surface px-5 py-[18px] shadow-card">
        <fieldset className="inline-flex w-fit gap-1 rounded-[14px] border-0 bg-surface2 p-1">
          <legend className="sr-only">Danh sách việc</legend>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex h-[30px] items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-extrabold",
                tab === t.key
                  ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                  : "text-muted hover:text-ink",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-pill px-1.5 text-[11px] font-extrabold text-ink2">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </fieldset>
        {current.isError ? (
          <div className="p-4 text-sub">{errorMessage(current.error)}</div>
        ) : (
          <TaskTable
            rows={current.data ?? []}
            loading={current.isPending}
            extraColumns={tab === "done" ? ["actualEnd"] : undefined}
            hiddenColumns={
              tab === "open"
                ? ["assignee", "creator", "createdAt", "startDate"]
                : ["assignee", "creator", "createdAt", "startDate", "status", "priority"]
            }
            emptyText={tab === "open" ? "Không có việc nào đang mở." : "Chưa có việc hoàn thành."}
          />
        )}
      </div>

      <EmployeeDialog open={editOpen} onOpenChange={setEditOpen} employee={e} />
      <DeactivateDialog open={retireOpen} onOpenChange={setRetireOpen} employee={e} />
    </div>
  );
}
