import { Link } from "@tanstack/react-router";
import { ListChecks, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "@/shared/api/errors";
import type { Dashboard, EmployeeWorkload, TaskRow } from "@/shared/api/types";
import { useTaskPanel } from "@/shared/hooks/use-task-panel";
import {
  formatShortDate,
  isOverdue,
  longDateLabel,
  overdueDays,
  overdueLabel,
  weekRangeLabel,
} from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";
import { Avatar, PersonLabel } from "@/shared/ui/avatar";
import { StatusChip, StatusIcon } from "@/shared/ui/status-chip";
import { useDashboard } from "./use-dashboard";

const CARD = "flex flex-col gap-2 rounded-card bg-surface px-5 py-[18px] shadow-card";
const ROW_HOVER = "hover:shadow-[inset_0_0_0_1.5px_var(--line)]";
const WGRID = "grid grid-cols-[260px_minmax(0,1fr)_72px_72px] gap-4";

/** SC-1 Tổng quan: 4 số · Cần chú ý (mở Chi tiết việc) · Theo nhân viên (mở SC-7). */
export function DashboardPage() {
  const dash = useDashboard();
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline gap-3 px-1.5 pt-0.5">
        <h1 className="text-h1">Tổng quan</h1>
        <span className="text-sub">{longDateLabel()}</span>
      </div>
      {dash.isPending ? (
        <div className={cn(CARD, "text-sub")}>Đang tải…</div>
      ) : dash.isError ? (
        <div className={cn(CARD, "text-sub")}>{errorMessage(dash.error)}</div>
      ) : (
        <DashboardContent data={dash.data} />
      )}
    </div>
  );
}

function DashboardContent({ data }: { data: Dashboard }) {
  return (
    <>
      <div className="grid grid-cols-4 gap-3.5">
        <Kpi
          label="Đang mở"
          value={data.openCount}
          note="việc chưa kết thúc"
          tip="Mới + Đang làm + Đang chờ"
          iconClass="bg-hero text-hero-ink"
          icon={<ListChecks className="size-[15px]" />}
        />
        <Kpi
          label="Quá hạn"
          value={data.overdueCount}
          note="việc đã qua hạn"
          tip="Đang mở và hạn chót trước hôm nay"
          iconClass="bg-danger-bg text-danger"
          icon={<TriangleAlert className="size-[15px]" />}
          danger={data.overdueCount > 0}
        />
        <Kpi
          label="Đang chờ"
          value={data.waitingCount}
          note="việc bị chặn"
          tip="Việc ở trạng thái Đang chờ"
          iconClass="bg-st-waiting-bg text-st-waiting-fg"
          icon={<StatusIcon status="waiting" className="size-[15px] [stroke-width:2]" />}
        />
        <Kpi
          label="Hoàn thành tuần này"
          value={data.doneThisWeekCount}
          note={weekRangeLabel()}
          tip="Việc Hoàn thành có Kết thúc thực tế trong tuần này"
          iconClass="bg-st-done-bg text-st-done-fg"
          icon={<StatusIcon status="done" className="size-[15px] [stroke-width:2]" />}
        />
      </div>
      <Attention rows={data.attention} />
      <Workload list={data.byEmployee} />
    </>
  );
}

function Kpi({
  label,
  value,
  note,
  tip,
  icon,
  iconClass,
  danger = false,
}: {
  label: string;
  value: number;
  note: string;
  tip: string;
  icon: ReactNode;
  iconClass: string;
  danger?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-0.5 rounded-card bg-surface px-4 py-3 shadow-card"
      title={tip}
    >
      <div className="flex items-center gap-2">
        <span className="font-extrabold text-[13.5px] text-ink2">{label}</span>
        <span
          className={cn(
            "ml-auto inline-flex size-7 items-center justify-center rounded-[10px]",
            iconClass,
          )}
        >
          {icon}
        </span>
      </div>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className={cn("num text-[28px] leading-[1.05]", danger && "text-danger")}>
          {value}
        </span>
        <span className="min-w-0 truncate text-[12.5px] text-muted">{note}</span>
      </div>
    </div>
  );
}

function Attention({ rows }: { rows: TaskRow[] }) {
  const { openTask } = useTaskPanel();
  return (
    <section className={CARD}>
      <div className="flex items-center gap-2.5 text-card-title">
        Cần chú ý
        <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-pill px-1.5 font-extrabold text-ink2 text-xs">
          {rows.length}
        </span>
        <span className="text-sub">Quá hạn, đến hạn hôm nay và mai · sắp theo hạn</span>
      </div>
      <div className="-mx-2.5 flex flex-col gap-0.5">
        {rows.map((t) => {
          const od = isOverdue(t);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => openTask(t.id)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-nav px-2.5 py-1.5 text-left",
                ROW_HOVER,
                od && "bg-overdue-row",
              )}
            >
              <span className="w-[60px] flex-none text-code">{t.code}</span>
              <span className="min-w-0 flex-1 font-bold text-[13.5px] leading-[1.3]">
                {t.title}
              </span>
              <span
                className="flex w-[190px] min-w-0 flex-none"
                title={t.assigneeName ?? "Chưa giao"}
              >
                <PersonLabel
                  name={t.assigneeName}
                  color={t.assigneeColor}
                  inactive={t.assigneeInactive}
                />
              </span>
              <span className="flex w-[130px] flex-none flex-col gap-px">
                <span
                  className={cn(
                    "whitespace-nowrap font-extrabold text-[12.5px]",
                    od ? "text-danger" : "text-ink2",
                  )}
                >
                  {formatShortDate(t.dueDate)}
                </span>
                {od && (
                  <span className="font-bold text-[11px] text-danger">
                    {overdueLabel(overdueDays(t.dueDate))}
                  </span>
                )}
              </span>
              <span className="flex w-[110px] flex-none">
                <StatusChip status={t.status} />
              </span>
            </button>
          );
        })}
        {rows.length === 0 && (
          <div className="p-2.5 text-sub">Không có việc quá hạn hay đến hạn hôm nay, mai.</div>
        )}
      </div>
    </section>
  );
}

function displayName(w: EmployeeWorkload): string {
  return w.isSelf && w.fullName !== "Tôi" ? `${w.fullName} (Tôi)` : w.fullName;
}

function Workload({ list }: { list: EmployeeWorkload[] }) {
  const maxOpen = Math.max(1, ...list.map((w) => w.openCount));
  return (
    <section className={CARD}>
      <div className="flex items-center gap-2.5 text-card-title">
        Theo nhân viên
        <span className="text-sub">Việc đang mở và quá hạn của mỗi người</span>
      </div>
      <div className={cn(WGRID, "items-end")}>
        <span className="whitespace-nowrap font-extrabold text-[11.5px] text-muted">
          Người phụ trách
        </span>
        <span />
        <span className="text-right font-extrabold text-[11.5px] text-muted">Đang mở</span>
        <span className="text-right font-extrabold text-[11.5px] text-muted">Quá hạn</span>
      </div>
      <div className="-mx-2 flex flex-col gap-px">
        {list.map((w) => {
          const name = displayName(w);
          const rest = w.openCount - w.overdueCount;
          return (
            <Link
              key={w.id}
              to="/employees/$employeeId"
              params={{ employeeId: w.id }}
              title={`${name}: ${w.openCount} đang mở, ${w.overdueCount} quá hạn`}
              className={cn(WGRID, "items-center rounded-nav px-2 py-[5px]", ROW_HOVER)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={w.fullName} color={w.color} />
                <span className="truncate font-bold text-[13px]">{name}</span>
              </span>
              <span className="flex h-2 min-w-0 overflow-hidden rounded-[4px] bg-pill">
                <span
                  className="block h-2 flex-none rounded-[4px] bg-danger"
                  style={{
                    width: `${(w.overdueCount / maxOpen) * 100}%`,
                    marginRight: w.overdueCount && rest > 0 ? 2 : 0,
                  }}
                />
                <span
                  className="block h-2 flex-none rounded-[4px] bg-bar-hot"
                  style={{ width: `${(rest / maxOpen) * 100}%` }}
                />
              </span>
              <span className="num text-right text-sm">{w.openCount}</span>
              <span
                className={cn(
                  "num text-right text-sm",
                  w.overdueCount ? "text-danger" : "text-muted",
                )}
              >
                {w.overdueCount}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
