import { Link } from "@tanstack/react-router";
import { Ellipsis, Pencil, Plus, Search, Trash2, UserMinus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import { useEmployees } from "@/shared/api/queries";
import type { EmployeeRow, EmployeeStatusFilter } from "@/shared/api/types";
import { AVATAR_COLORS } from "@/shared/lib/colors";
import { includesFolded } from "@/shared/lib/fold-vi";
import { cn } from "@/shared/lib/utils";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { DeactivateDialog } from "./DeactivateDialog";
import { DeleteEmployeeDialogs } from "./DeleteEmployeeDialogs";
import { EmployeeDialog } from "./EmployeeDialog";
import { EmployeeStatusChip, SelfChip } from "./EmployeeStatusChip";

const NO_ROWS: EmployeeRow[] = [];
const GRID =
  "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_112px_minmax(0,1.2fr)_64px_64px_128px] items-center gap-x-2.5";
const FILTERS: { key: EmployeeStatusFilter; label: string }[] = [
  { key: "active", label: "Đang làm việc" },
  { key: "inactive", label: "Đã nghỉ" },
  { key: "all", label: "Tất cả" },
];
const MENU_ITEM = "min-h-9 rounded-[10px] px-2.5 text-[13.5px] font-bold [&_svg]:size-[15px]";

/** Hộp thoại gắn với một nhân viên; giữ `employee` khi đóng để hộp không đổi chữ lúc mờ dần. */
interface DialogState {
  open: boolean;
  employee: EmployeeRow | null;
}
const CLOSED: DialogState = { open: false, employee: null };

/** SC-6 Nhân viên: bảng, lọc trạng thái, tìm không dấu, Thêm/Sửa, Chuyển Đã nghỉ, Xoá. */
export function EmployeesPage() {
  const list = useEmployees("all");
  const all = list.data ?? NO_ROWS;
  const [status, setStatus] = useState<EmployeeStatusFilter>("active");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<DialogState>(CLOSED);
  const [retire, setRetire] = useState<DialogState>(CLOSED);
  const [remove, setRemove] = useState<DialogState>(CLOSED);

  const counts = useMemo(() => {
    const active = all.filter((e) => e.status === "active").length;
    return { active, inactive: all.length - active, all: all.length };
  }, [all]);
  const matches = useMemo(() => all.filter((e) => includesFolded(e.fullName, q)), [all, q]);
  const rows = useMemo(
    () => (status === "all" ? matches : matches.filter((e) => e.status === status)),
    [matches, status],
  );

  const open = (set: (s: DialogState) => void) => (employee: EmployeeRow | null) =>
    set({ open: true, employee });
  const close = (set: (f: (s: DialogState) => DialogState) => void) => () =>
    set((s) => ({ ...s, open: false }));

  const statusLabel = FILTERS.find((f) => f.key === status)?.label ?? "";
  const otherHits = matches.length - rows.length;
  const emptyMsg =
    `Không có nhân viên nào khớp ${q.trim() ? `từ khoá “${q.trim()}”, ` : ""}trạng thái “${statusLabel}”.` +
    (otherHits > 0
      ? ` Có ${otherHits} người khớp ở trạng thái khác — chọn “Tất cả”.`
      : " Thử gõ không dấu hoặc xoá bộ lọc.");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      <div className="flex flex-none items-end gap-4 px-1.5 pt-1.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">Nhân viên</h1>
          <div className="text-sub">
            Danh mục người được giao việc · {counts.active} đang làm việc, {counts.inactive} đã nghỉ
          </div>
        </div>
        <Button className="ml-auto" onClick={() => open(setForm)(null)}>
          <Plus />
          Thêm nhân viên
        </Button>
      </div>

      <div className="flex flex-none items-center gap-2.5">
        <div className="flex h-10 w-[330px] items-center gap-2 rounded-field bg-surface px-3 shadow-card focus-within:shadow-[inset_0_0_0_1.5px_var(--focus)]">
          <Search className="size-[15px] flex-none text-muted" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo họ tên, ví dụ: duc anh"
            aria-label="Tìm nhân viên theo họ tên"
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none placeholder:font-semibold placeholder:text-muted"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              title="Xoá nội dung tìm"
              aria-label="Xoá nội dung tìm"
              className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-surface2 text-muted hover:text-ink"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <fieldset className="inline-flex gap-1 rounded-[14px] border-0 bg-surface p-1 shadow-card">
          <legend className="sr-only">Lọc theo trạng thái</legend>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={status === f.key}
              onClick={() => setStatus(f.key)}
              className={cn(
                "flex h-[30px] items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-extrabold",
                status === f.key
                  ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                  : "text-muted hover:text-ink",
              )}
            >
              {f.label}
              <span className="text-[11.5px] font-extrabold opacity-75">{counts[f.key]}</span>
            </button>
          ))}
        </fieldset>
        <span className="ml-auto pr-1.5 text-[12.5px] font-semibold text-muted">
          {rows.length} nhân viên
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-card bg-surface px-3 pt-1.5 pb-2.5 shadow-card">
        <div className="flex flex-none items-center border-b-[1.5px] border-line">
          <div
            className={cn(
              GRID,
              "min-h-11 min-w-0 flex-1 px-2.5 text-xs leading-tight font-extrabold text-muted",
            )}
          >
            <span>Họ tên</span>
            <span>Chức danh</span>
            <span>Điện thoại</span>
            <span>Email</span>
            <span className="text-right">Đang mở</span>
            <span className="text-right">Quá hạn</span>
            <span>Trạng thái</span>
          </div>
          <span className="mr-1 w-[30px] flex-none" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.isPending && <div className="p-4 text-sub">Đang tải…</div>}
          {list.isError && <div className="p-4 text-sub">{errorMessage(list.error)}</div>}
          {rows.map((e) => (
            <div key={e.id} className="flex items-center border-b border-line hover:bg-surface2">
              <Link
                to="/employees/$employeeId"
                params={{ employeeId: e.id }}
                title="Mở chi tiết nhân viên"
                className={cn(
                  GRID,
                  "min-h-[52px] min-w-0 flex-1 px-2.5 text-[13.5px] font-semibold text-ink2",
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={e.fullName} color={e.color} />
                  <span className="truncate text-sm font-extrabold text-ink">{e.fullName}</span>
                  {e.isSelf && <SelfChip />}
                </span>
                <span className="truncate" title={e.title ?? undefined}>
                  {e.title}
                </span>
                <span className="truncate">{e.phone}</span>
                <span className="truncate" title={e.email ?? undefined}>
                  {e.email}
                </span>
                <span className="num text-right text-ink">{e.openCount}</span>
                <span
                  className={cn(
                    "num text-right",
                    e.overdueCount > 0 ? "text-danger" : "text-muted",
                  )}
                >
                  {e.overdueCount}
                </span>
                <span>
                  <EmployeeStatusChip status={e.status} />
                </span>
              </Link>
              <RowMenu
                employee={e}
                onEdit={open(setForm)}
                onRetire={open(setRetire)}
                onDelete={open(setRemove)}
              />
            </div>
          ))}

          {list.isSuccess && rows.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 px-5 py-16 text-center">
              <div className="flex size-[52px] items-center justify-center rounded-full bg-surface2 text-muted">
                <Search className="size-[18px]" aria-hidden="true" />
              </div>
              <div className="text-card-title">Không tìm thấy nhân viên nào</div>
              <div className="max-w-[420px] text-sub leading-normal">{emptyMsg}</div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQ("");
                  setStatus("all");
                }}
              >
                Xoá bộ lọc
              </Button>
            </div>
          )}
        </div>
        <p className="px-2.5 pt-2.5 text-[12.5px] leading-[1.45] font-semibold text-muted">
          Đang mở, Quá hạn: việc người này đang phụ trách. Bấm một dòng để xem chi tiết.
        </p>
      </div>

      <EmployeeDialog
        open={form.open}
        onOpenChange={(o) => !o && close(setForm)()}
        employee={form.employee}
        defaultColor={AVATAR_COLORS[all.length % AVATAR_COLORS.length]}
      />
      <DeactivateDialog
        open={retire.open}
        onOpenChange={(o) => !o && close(setRetire)()}
        employee={retire.employee}
      />
      <DeleteEmployeeDialogs
        open={remove.open}
        employee={remove.employee}
        onClose={close(setRemove)}
        onRetire={open(setRetire)}
      />
    </div>
  );
}

/** Menu ⋯: Sửa thông tin · Chuyển sang Đã nghỉ · Xoá nhân viên. Hồ sơ "Tôi" chỉ có Sửa. */
function RowMenu({
  employee: e,
  onEdit,
  onRetire,
  onDelete,
}: {
  employee: EmployeeRow;
  onEdit: (e: EmployeeRow) => void;
  onRetire: (e: EmployeeRow) => void;
  onDelete: (e: EmployeeRow) => void;
}) {
  return (
    // modal={false}: mở hộp thoại ngay từ mục menu mà không kẹt focus/pointer-events.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Thao tác với ${e.fullName}`}
          title="Thao tác với nhân viên"
          className="mr-1 inline-flex size-[30px] flex-none items-center justify-center rounded-full text-muted hover:bg-pill hover:text-ink"
        >
          <Ellipsis className="size-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5 shadow-pop">
        <DropdownMenuItem className={MENU_ITEM} onSelect={() => onEdit(e)}>
          <Pencil />
          Sửa thông tin
        </DropdownMenuItem>
        {!e.isSelf && e.status === "active" && (
          <DropdownMenuItem className={MENU_ITEM} onSelect={() => onRetire(e)}>
            <UserMinus />
            Chuyển sang Đã nghỉ
          </DropdownMenuItem>
        )}
        {!e.isSelf && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className={MENU_ITEM}
              onSelect={() => onDelete(e)}
            >
              <Trash2 />
              Xoá nhân viên
            </DropdownMenuItem>
          </>
        )}
        {e.isSelf && (
          <p className="px-2.5 pt-1.5 pb-1 text-xs leading-[1.4] font-semibold text-muted">
            Đây là hồ sơ của bạn (Tôi): không xoá và không chuyển sang Đã nghỉ được.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
