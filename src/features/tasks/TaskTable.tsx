import { ArrowDown, ArrowUp, MessageCircle, Paperclip, SquareCheckBig } from "lucide-react";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEmployees } from "@/shared/api/queries";
import type { TaskRow } from "@/shared/api/types";
import { useTaskPanel } from "@/shared/hooks/use-task-panel";
import {
  formatDateTime,
  formatShortDate,
  formatShortDateTime,
  isOverdue,
  overdueDays,
  overdueLabel,
} from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";
import { Avatar, InactiveBadge } from "@/shared/ui/avatar";
import { PriorityLabel } from "@/shared/ui/priority-label";
import { ProjectDot } from "@/shared/ui/project-dot";
import { StatusChip } from "@/shared/ui/status-chip";
import { DEFAULT_SORT, sortTaskRows, type TaskColumn, type TaskSort } from "./task-filters";

export type { TaskColumn } from "./task-filters";

export interface TaskTableProps {
  rows: TaskRow[];
  /** cột ẩn (ví dụ ["project"] khi đã khoá theo dự án) */
  hiddenColumns?: TaskColumn[];
  /** cột mặc định ẩn, chỉ hiện khi nêu ở đây (ví dụ ["actualEnd"] ở SC-7 tab Đã hoàn thành) */
  extraColumns?: TaskColumn[];
  loading?: boolean;
  /** chữ khi không có dòng nào */
  emptyText?: string;
  /** mặc định: mở panel Chi tiết việc (?task=id) */
  onRowClick?: (row: TaskRow) => void;
}

interface ColumnDef {
  key: TaskColumn;
  label: string;
  width: string;
  /** cột mặc định ẩn, chỉ hiện khi có trong `extraColumns` */
  optional?: boolean;
}

/** Thứ tự và độ rộng cột theo design/Tasks.dc.html. */
const COLUMNS: readonly ColumnDef[] = [
  { key: "code", label: "Mã", width: "60px" },
  { key: "title", label: "Tiêu đề", width: "minmax(0,1fr)" },
  { key: "project", label: "Dự án", width: "58px" },
  { key: "assignee", label: "Người phụ trách", width: "118px" },
  { key: "status", label: "Trạng thái", width: "106px" },
  { key: "priority", label: "Ưu tiên", width: "88px" },
  { key: "startDate", label: "Bắt đầu", width: "58px" },
  { key: "dueDate", label: "Hạn", width: "84px" },
  { key: "actualEnd", label: "Kết thúc thực tế", width: "112px", optional: true },
  { key: "creator", label: "Người tạo", width: "94px" },
  { key: "createdAt", label: "Ngày tạo", width: "64px" },
];

/** Số dòng dựng mỗi đợt — cuộn tới cuối thì dựng thêm (bảng lớn vẫn mượt). */
const PAGE = 150;

const ROW_GRID = "grid items-center gap-x-2 px-2.5";

/**
 * Bảng việc dùng chung: SC-2 và chế độ Danh sách của SC-3 (F3 import), SC-7 có thể dùng.
 * Bấm tiêu đề cột để sắp xếp (mặc định Ngày tạo mới nhất trước), dòng quá hạn nền đỏ nhạt,
 * chỉ gạch ngang việc Đã huỷ, bấm dòng mở Chi tiết việc.
 */
export function TaskTable({
  rows,
  hiddenColumns,
  extraColumns,
  loading = false,
  emptyText = "Không có việc nào.",
  onRowClick,
}: TaskTableProps) {
  const { openTask } = useTaskPanel();
  const employees = useEmployees("all");
  const [sort, setSort] = useState<TaskSort>(DEFAULT_SORT);
  const [limit, setLimit] = useState(PAGE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  const hiddenKey = hiddenColumns?.join(",") ?? "";
  const extraKey = extraColumns?.join(",") ?? "";
  const cols = useMemo(() => {
    const hidden = hiddenKey.split(",");
    const extra = extraKey.split(",");
    return COLUMNS.filter((c) => !hidden.includes(c.key) && (!c.optional || extra.includes(c.key)));
  }, [hiddenKey, extraKey]);
  const template = cols.map((c) => c.width).join(" ");

  // Người tạo: TaskRow không có màu → lấy từ danh mục nhân viên (đã đệm sẵn).
  const colorById = useMemo(
    () => new Map((employees.data ?? []).map((e) => [e.id, e.color] as const)),
    [employees.data],
  );

  const sorted = useMemo(() => sortTaskRows(rows, sort), [rows, sort]);
  const visible = useMemo(() => sorted.slice(0, limit), [sorted, limit]);
  const hasMore = sorted.length > limit;

  // Handler ổn định để dòng (memo) không dựng lại khi nơi gọi truyền hàm mới.
  const clickRef = useRef(onRowClick);
  useLayoutEffect(() => {
    clickRef.current = onRowClick;
  });
  const onOpen = useCallback(
    (row: TaskRow) => {
      const handler = clickRef.current;
      if (handler) handler(row);
      else openTask(row.id);
    },
    [openTask],
  );

  const toggleSort = useCallback((key: TaskColumn) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
    setLimit(PAGE);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const el = moreRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);

  let body: ReactNode;
  if (loading) {
    body = <div className="px-2.5 py-10 text-center text-sub">Đang tải…</div>;
  } else if (rows.length === 0) {
    body = <div className="px-2.5 py-10 text-center text-sub">{emptyText}</div>;
  } else {
    body = (
      <div className="flex flex-col gap-px pt-1">
        {visible.map((r) => (
          <TaskTableRow
            key={r.id}
            row={r}
            cols={cols}
            template={template}
            creatorColor={colorById.get(r.creatorId)}
            onOpen={onOpen}
          />
        ))}
        {hasMore && (
          <button
            ref={moreRef}
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="mx-auto my-2 rounded-full px-3.5 py-1.5 text-sub hover:bg-surface2"
          >
            Hiện thêm việc ({sorted.length - limit} việc nữa)
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card bg-surface px-1.5 pb-1.5 shadow-card">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            ROW_GRID,
            "sticky top-0 z-[2] border-line border-b-[1.5px] bg-surface pt-3 pb-[9px]",
          )}
          style={{ gridTemplateColumns: template }}
        >
          {cols.map((c) => {
            const on = sort.key === c.key;
            const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleSort(c.key)}
                title={`Sắp xếp theo ${c.label.toLowerCase()}`}
                className={cn(
                  "flex min-w-0 items-center gap-0.5 whitespace-nowrap text-left font-extrabold text-muted text-xs hover:text-ink",
                  on && "text-ink",
                )}
              >
                {c.label}
                {on && <Arrow className="size-[13px] flex-none" strokeWidth={2.6} />}
              </button>
            );
          })}
        </div>
        {body}
      </div>
    </div>
  );
}

const TaskTableRow = memo(function TaskTableRow({
  row,
  cols,
  template,
  creatorColor,
  onOpen,
}: {
  row: TaskRow;
  cols: readonly ColumnDef[];
  template: string;
  creatorColor: string | undefined;
  onOpen: (row: TaskRow) => void;
}) {
  const overdue = isOverdue(row);
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className={cn(
        ROW_GRID,
        "min-h-[46px] w-full rounded-[12px] py-2 text-left font-semibold text-[13px] hover:shadow-[inset_0_0_0_1.5px_var(--line)]",
        overdue && "bg-overdue-row",
      )}
      style={{ gridTemplateColumns: template }}
    >
      {cols.map((c) => (
        <Cell key={c.key} col={c.key} row={row} overdue={overdue} creatorColor={creatorColor} />
      ))}
    </button>
  );
});

function Cell({
  col,
  row,
  overdue,
  creatorColor,
}: {
  col: TaskColumn;
  row: TaskRow;
  overdue: boolean;
  creatorColor: string | undefined;
}) {
  switch (col) {
    case "code":
      return <span className="min-w-0 text-code">{row.code}</span>;
    case "title":
      return <TitleCell row={row} />;
    case "project":
      return (
        <span className="flex min-w-0 items-center gap-1.5" title={row.projectName}>
          <ProjectDot color={row.projectColor} />
          <span className="text-code" style={{ color: "var(--ink2)" }}>
            {row.projectCode}
          </span>
        </span>
      );
    case "assignee":
      return (
        <span className="flex min-w-0 items-center gap-1.5" title={row.assigneeName ?? "Chưa giao"}>
          <Avatar
            name={row.assigneeName}
            color={row.assigneeColor}
            className="size-[22px] text-[9.5px]"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              className={cn(
                "break-words font-bold text-[12.5px] leading-[1.25]",
                !row.assigneeName && "text-muted",
              )}
            >
              {row.assigneeName ?? "Chưa giao"}
            </span>
            {row.assigneeInactive && (
              <span className="self-start">
                <InactiveBadge />
              </span>
            )}
          </span>
        </span>
      );
    case "status":
      return (
        <span className="flex min-w-0">
          <StatusChip status={row.status} />
        </span>
      );
    case "priority":
      return (
        <span className="flex min-w-0">
          <PriorityLabel priority={row.priority} className="[&_svg]:size-[13px]" />
        </span>
      );
    case "startDate":
      return (
        <span className="min-w-0 whitespace-nowrap text-[12.5px] text-ink2 tabular-nums">
          {formatShortDate(row.startDate) || "—"}
        </span>
      );
    case "dueDate":
      return (
        <span className="flex min-w-0 flex-col items-start gap-px">
          <span
            className={cn(
              "whitespace-nowrap font-bold text-[12.5px] tabular-nums",
              overdue ? "text-danger" : row.dueDate ? "text-ink2" : "text-muted",
            )}
          >
            {formatShortDate(row.dueDate) || "—"}
          </span>
          {overdue && (
            <span className="whitespace-nowrap font-bold text-[11px] text-danger">
              {overdueLabel(overdueDays(row.dueDate))}
            </span>
          )}
        </span>
      );
    case "creator":
      return (
        <span className="flex min-w-0 items-center gap-1.5" title={row.creatorName}>
          <Avatar
            name={row.creatorName}
            color={creatorColor}
            className="size-[22px] text-[9.5px]"
          />
          <span className="break-words font-bold text-[12.5px] leading-[1.25]">
            {row.creatorName}
          </span>
        </span>
      );
    case "createdAt":
      return (
        <span
          className="min-w-0 whitespace-nowrap text-[12.5px] text-muted tabular-nums"
          title={`Tạo lúc ${formatDateTime(row.createdAt)}`}
        >
          {formatShortDateTime(row.createdAt)}
        </span>
      );
    case "actualEnd":
      return (
        <span
          className="min-w-0 whitespace-nowrap text-[12.5px] text-ink2 tabular-nums"
          title={
            row.actualEndAt != null ? `Kết thúc lúc ${formatDateTime(row.actualEndAt)}` : undefined
          }
        >
          {row.actualEndAt != null ? formatShortDateTime(row.actualEndAt) : "—"}
        </span>
      );
  }
}

function TitleCell({ row }: { row: TaskRow }) {
  const hasMeta = row.subtaskTotal > 0 || row.commentCount > 0 || row.attachmentCount > 0;
  return (
    <span className="flex min-w-0 flex-col gap-[3px]">
      <span
        className={cn(
          "line-clamp-2 break-words font-bold text-[13.5px] leading-[1.3]",
          row.status === "cancelled" && "font-semibold text-muted line-through",
        )}
      >
        {row.title}
      </span>
      {hasMeta && (
        <span className="flex gap-2.5">
          {row.subtaskTotal > 0 && (
            <Meta title="Việc con đã xong / tổng" icon={SquareCheckBig}>
              {row.subtaskDone}/{row.subtaskTotal}
            </Meta>
          )}
          {row.commentCount > 0 && (
            <Meta title="Bình luận" icon={MessageCircle}>
              {row.commentCount}
            </Meta>
          )}
          {row.attachmentCount > 0 && (
            <Meta title="Tệp đính kèm" icon={Paperclip}>
              {row.attachmentCount}
            </Meta>
          )}
        </span>
      )}
    </span>
  );
}

function Meta({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Paperclip;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-[3px] font-bold text-[11.5px] text-muted"
      title={title}
    >
      <Icon className="size-3" strokeWidth={2} />
      {children}
    </span>
  );
}
