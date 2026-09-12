import { CheckIcon, CopyIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { type ReactNode, useEffect, useState } from "react";
import { errorMessage } from "@/shared/api/errors";
import type { TaskDetail } from "@/shared/api/types";
import {
  formatDate,
  formatDateTime,
  isOverdue,
  overdueDays,
  overdueLabel,
} from "@/shared/lib/date";
import { statusHasNote, statusNoteLabel } from "@/shared/lib/status";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/stores/ui";
import { PersonLabel } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { PriorityLabel } from "@/shared/ui/priority-label";
import { ProjectDot } from "@/shared/ui/project-dot";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { toast } from "@/shared/ui/sonner";
import { StatusIcon } from "@/shared/ui/status-chip";
import { ActualTimeCell } from "./ActualTimeCell";
import { CommentsTab } from "./CommentsTab";
import { FilesTab } from "./FilesTab";
import { HistoryTab } from "./HistoryTab";
import { StatusMenu } from "./StatusMenu";
import { SubtasksTab } from "./SubtasksTab";
import { useDeleteTask, useTaskDetail } from "./use-task-detail";

/** Đang sửa tại chỗ (ô ngày giờ thực tế) → Esc chỉ huỷ sửa, không đóng panel. */
function isInlineEditing(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.closest("[data-inline-edit]") !== null;
}

/**
 * SC-5 Chi tiết việc — panel phải 560px, mở theo `?task=`. Nền mờ nhưng vẫn bấm được dòng/thẻ
 * khác để đổi việc (design/TaskDetail.dc.html) → Sheet không modal, lớp mờ không chặn chuột.
 */
export function TaskDetailPanel({
  taskId,
  onClose,
}: {
  taskId: number | null;
  onClose: () => void;
}) {
  const open = taskId !== null;
  // Giữ việc cuối cùng để nội dung không biến mất khi panel đang trượt ra.
  const [shownId, setShownId] = useState(taskId);
  if (taskId !== null && taskId !== shownId) setShownId(taskId);

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-40 animate-in bg-scrim fade-in-0"
        />
      )}
      <Sheet open={open} onOpenChange={(o) => !o && onClose()} modal={false}>
        <SheetContent
          side="right"
          showCloseButton={false}
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (isInlineEditing()) e.preventDefault();
          }}
          className="inset-y-3 right-3 h-auto w-[560px] gap-0 overflow-hidden rounded-panel sm:max-w-[560px]"
        >
          {shownId !== null && (
            <TaskDetailContent key={shownId} taskId={shownId} onClose={onClose} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="text-muted hover:text-ink"
    >
      {children}
    </Button>
  );
}

function TaskDetailContent({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const q = useTaskDetail(taskId);
  // Còn dữ liệu cũ thì vẫn hiện (ví dụ vừa chuyển vào Thùng rác, panel đang đóng).
  if (q.data) return <TaskView task={q.data} onClose={onClose} />;
  return (
    <div className="flex flex-col gap-2 px-5 pt-4 pb-3">
      <div className="flex items-center gap-2">
        <SheetTitle className="text-card-title">
          {q.isError ? "Không mở được việc" : "Đang tải…"}
        </SheetTitle>
        <div className="ml-auto">
          <IconBtn title="Đóng" onClick={onClose}>
            <XIcon />
          </IconBtn>
        </div>
      </div>
      {q.isError && <p className="text-sub">{errorMessage(q.error)}</p>}
    </div>
  );
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      title="Sao chép mã"
      aria-label={`Sao chép mã ${code}`}
      onClick={() => {
        navigator.clipboard?.writeText(code).then(
          () => setCopied(true),
          () => {},
        );
      }}
      className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-surface2 px-3 text-xs font-extrabold tracking-[0.02em] whitespace-nowrap text-ink2 tabular-nums hover:bg-pill"
    >
      {code}
      {copied ? (
        <CheckIcon className="size-3.5" aria-hidden="true" />
      ) : (
        <CopyIcon className="size-3.5 text-muted" aria-hidden="true" />
      )}
    </button>
  );
}

function InfoCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px] rounded-[12px] px-2.5 py-[7px]">
      <span className="text-[11.5px] font-extrabold text-muted">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-[7px] text-[13.5px] font-bold">
        {children}
      </div>
    </div>
  );
}

function Count({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pill px-[5px] text-[11.5px] text-ink2">
      {children}
    </span>
  );
}

const TAB_CLASS =
  "-mb-[1.5px] flex items-center gap-1.5 border-b-[2.5px] border-transparent px-[9px] py-2.5 text-[13.5px] font-extrabold whitespace-nowrap text-muted outline-none hover:text-ink data-[state=active]:border-bar-hot data-[state=active]:text-ink";

function TaskView({ task, onClose }: { task: TaskDetail; onClose: () => void }) {
  const del = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState("subs");
  const overdue = isOverdue(task);
  const doneSubs = task.subtasks.filter((s) => s.isDone).length;
  const hasNote = statusHasNote(task.status) && !!task.statusNote;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Đầu: mã · trạng thái · Sửa · Xoá · Đóng · tiêu đề · mô tả (chỉ đọc) */}
      <div className="flex flex-none flex-col gap-2 border-b px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <CopyCode code={task.code} />
          <StatusMenu task={task} />
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => useUiStore.getState().openEditTask(task.id)}
          >
            <PencilIcon />
            Sửa
          </Button>
          <IconBtn title="Xoá việc" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon />
          </IconBtn>
          <IconBtn title="Đóng" onClick={onClose}>
            <XIcon />
          </IconBtn>
        </div>
        <SheetTitle
          className={cn(
            "text-[21px] leading-[1.3] font-extrabold break-words text-ink",
            task.status === "cancelled" && "text-muted line-through",
          )}
        >
          {task.title}
        </SheetTitle>
        <div className="flex flex-col gap-[3px]">
          <span className="text-[11.5px] font-extrabold text-muted">Mô tả</span>
          {task.description?.trim() ? (
            <p className="max-h-[82px] overflow-y-auto text-[13.5px] leading-normal font-semibold break-words whitespace-pre-wrap text-ink2">
              {task.description}
            </p>
          ) : (
            <p className="text-[13.5px] font-semibold text-muted">Chưa có mô tả</p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 pt-3.5 pb-[22px]">
        {hasNote && (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-nav px-3.5 py-2.5 text-[13.5px] font-bold",
              task.status === "cancelled" ? "bg-surface2 text-ink2" : "bg-warn-bg text-warn",
            )}
          >
            <StatusIcon status={task.status} className="size-[18px] [stroke-width:2]" />
            <span className="min-w-0 flex-1 break-words">
              {statusNoteLabel(task.status)}: {task.statusNote}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <InfoCell label="Dự án">
            <ProjectDot color={task.projectColor} />
            <span className="min-w-0 truncate">{task.projectName}</span>
            <span className="text-code">{task.projectCode}</span>
          </InfoCell>
          <InfoCell label="Người phụ trách">
            <PersonLabel
              name={task.assigneeName}
              color={task.assigneeColor}
              inactive={task.assigneeInactive}
            />
          </InfoCell>
          <InfoCell label="Người tạo">
            <PersonLabel
              name={task.creatorName}
              color={task.creatorColor}
              inactive={task.creatorInactive}
            />
          </InfoCell>
          <InfoCell label="Ưu tiên">
            <PriorityLabel priority={task.priority} className="text-[13.5px]" />
          </InfoCell>
          <InfoCell label="Ngày bắt đầu">
            {task.startDate ? formatDate(task.startDate) : "—"}
          </InfoCell>
          <InfoCell label="Hạn chót">
            <span className={cn(overdue && "text-danger")}>
              {task.dueDate ? formatDate(task.dueDate) : "—"}
            </span>
            {overdue && (
              <span className="inline-flex h-[22px] items-center rounded-chip bg-danger-bg px-[9px] text-xs font-extrabold whitespace-nowrap text-danger">
                {overdueLabel(overdueDays(task.dueDate))}
              </span>
            )}
          </InfoCell>
          <ActualTimeCell task={task} field="actualStartAt" />
          <ActualTimeCell task={task} field="actualEndAt" />
          <InfoCell label="Ngày tạo">{formatDateTime(task.createdAt)}</InfoCell>
          <InfoCell label="Cập nhật lần cuối">{formatDateTime(task.updatedAt)}</InfoCell>
        </div>

        <TabsPrimitive.Root value={tab} onValueChange={setTab} className="flex flex-col gap-3.5">
          <TabsPrimitive.List className="flex gap-0.5 border-b-[1.5px]">
            <TabsPrimitive.Trigger value="subs" className={TAB_CLASS}>
              Việc con
              <Count>
                {doneSubs}/{task.subtasks.length}
              </Count>
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger value="comments" className={TAB_CLASS}>
              Bình luận
              <Count>{task.comments.length}</Count>
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger value="files" className={TAB_CLASS}>
              Tệp
              <Count>{task.attachments.length}</Count>
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger value="history" className={TAB_CLASS}>
              Lịch sử
              <Count>{task.history.length}</Count>
            </TabsPrimitive.Trigger>
          </TabsPrimitive.List>
          <TabsPrimitive.Content value="subs" className="outline-none">
            <SubtasksTab task={task} />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="comments" className="outline-none">
            <CommentsTab task={task} />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="files" className="outline-none">
            <FilesTab task={task} />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="history" className="outline-none">
            <HistoryTab history={task.history} />
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Xoá ${task.code}?`}
        description="Việc sẽ được chuyển vào Thùng rác và tự xoá vĩnh viễn sau 30 ngày."
        confirmLabel="Xoá"
        pending={del.isPending}
        onConfirm={() =>
          del.mutate(task.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              toast.success(`Đã chuyển ${task.code} vào Thùng rác`);
              onClose();
            },
          })
        }
      />
    </div>
  );
}
