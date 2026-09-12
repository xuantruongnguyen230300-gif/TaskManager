import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useEmployees } from "@/shared/api/queries";
import type { EmployeeRow, Id } from "@/shared/api/types";
import { cn } from "@/shared/lib/utils";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { StatusChip } from "@/shared/ui/status-chip";
import { useDeactivateEmployee, useEmployeeTasks } from "./use-employees";

export type DeactivateTarget = Pick<EmployeeRow, "id" | "fullName" | "color">;

/**
 * R-04: "Chuyển {họ tên} sang Đã nghỉ?" — còn việc chưa xong thì bắt chọn giao tất cả cho một
 * nhân viên đang làm việc khác hoặc "Chưa giao".
 */
export function DeactivateDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: DeactivateTarget | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        {employee && <DeactivateForm employee={employee} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

/** null = chưa chọn; "unassigned" = Chưa giao */
type Choice = Id | "unassigned" | null;

function PersonOption({
  name,
  color,
  sub,
  on,
  onPick,
}: {
  name: string | null;
  color?: string;
  sub: string;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex min-h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-bold hover:bg-surface2",
        on && "bg-surface2 font-extrabold",
      )}
    >
      <Avatar name={name} color={color} />
      <span className="min-w-0 flex-1 truncate">{name ?? "Chưa giao"}</span>
      <span className="truncate text-[12.5px] font-semibold text-muted">{sub}</span>
    </button>
  );
}

function DeactivateForm({ employee, onDone }: { employee: DeactivateTarget; onDone: () => void }) {
  const tasks = useEmployeeTasks({ assignee: employee.id }); // mặc định 3 trạng thái đang mở
  const people = useEmployees("all").data;
  const candidates = useMemo(
    () => (people ?? []).filter((p) => p.status === "active" && p.id !== employee.id),
    [people, employee.id],
  );
  const [pick, setPick] = useState<Choice>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const deactivate = useDeactivateEmployee();

  const openRows = tasks.data ?? [];
  const n = openRows.length;
  const chosen = typeof pick === "number" ? candidates.find((c) => c.id === pick) : undefined;
  const ready = tasks.isSuccess && (n === 0 || pick !== null);
  const choose = (p: Choice) => {
    setPick(p);
    setMenuOpen(false);
  };

  let sub = "";
  if (tasks.isSuccess) {
    sub = n > 0 ? `${employee.fullName} còn ${n} việc chưa xong.` : "Không còn việc nào chưa xong";
  }

  return (
    <>
      <DialogHeader className="flex-row items-center gap-2.5">
        <Avatar name={employee.fullName} color={employee.color} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle className="text-lg">Chuyển {employee.fullName} sang Đã nghỉ?</DialogTitle>
          <DialogDescription className="text-[12.5px] font-semibold text-muted">
            {sub}
          </DialogDescription>
        </div>
      </DialogHeader>

      {n > 0 && (
        <>
          <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">
            {openRows.map((t) => (
              <div
                key={t.id}
                className="flex min-w-0 items-center gap-2.5 rounded-field bg-surface2 px-3 py-2"
              >
                <span className="text-code">{t.code}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold">
                  {t.title}
                </span>
                <StatusChip status={t.status} />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-label">Giao tất cả cho:</span>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 min-w-0 items-center gap-2 rounded-field bg-surface2 px-2.5 text-sm font-bold shadow-[inset_0_0_0_1.5px_var(--line)]"
                >
                  <Avatar name={chosen?.fullName ?? null} color={chosen?.color} />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-left",
                      pick === null && "text-muted",
                    )}
                  >
                    {pick === null ? "Chọn người nhận…" : (chosen?.fullName ?? "Chưa giao")}
                  </span>
                  <ChevronDown className="size-[15px] text-muted" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-[250px] w-(--radix-popover-trigger-width) overflow-y-auto rounded-2xl p-1.5 shadow-pop"
              >
                {candidates.map((c) => (
                  <PersonOption
                    key={c.id}
                    name={c.fullName}
                    color={c.color}
                    sub={c.title ?? ""}
                    on={pick === c.id}
                    onPick={() => choose(c.id)}
                  />
                ))}
                <PersonOption
                  name={null}
                  sub="không có người phụ trách"
                  on={pick === "unassigned"}
                  onPick={() => choose("unassigned")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}
      {tasks.isSuccess && n === 0 && (
        <div className="flex items-center gap-2.5 rounded-nav bg-surface2 px-3.5 py-2.5 text-[13.5px] font-bold text-ink2">
          <Check className="size-[18px] flex-none" aria-hidden="true" />
          {employee.fullName} không phụ trách việc nào chưa xong — chỉ cần xác nhận.
        </div>
      )}
      <p className="text-[12.5px] leading-[1.45] font-semibold text-muted">
        Sau khi chuyển, {employee.fullName} không còn trong danh sách chọn người phụ trách. Việc cũ
        vẫn giữ tên kèm nhãn “Đã nghỉ”.
      </p>

      <DialogFooter>
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button
          disabled={!ready || deactivate.isPending}
          onClick={() =>
            deactivate.mutate(
              {
                id: employee.id,
                fullName: employee.fullName,
                reassignTo: typeof pick === "number" ? pick : null,
              },
              { onSuccess: onDone },
            )
          }
        >
          Chuyển
        </Button>
      </DialogFooter>
    </>
  );
}
