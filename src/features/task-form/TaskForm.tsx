import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  FileIcon,
  Flag,
  HashIcon,
  InfoIcon,
  PaperclipIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { api } from "@/shared/api/commands";
import { errorMessage, isAppError } from "@/shared/api/errors";
import { invalidateTaskData, queryKeys } from "@/shared/api/query-keys";
import type { ProjectSummary, TaskDetail } from "@/shared/api/types";
import { formatDateTime } from "@/shared/lib/date";
import { formatFileSize } from "@/shared/lib/format";
import { PRIORITY_META, PRIORITY_ORDER } from "@/shared/lib/priority";
import { STATUS_META, STATUS_ORDER, statusHasNote, statusNoteLabel } from "@/shared/lib/status";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { DialogClose, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { toast } from "@/shared/ui/sonner";
import { StatusIcon } from "@/shared/ui/status-chip";
import { Textarea } from "@/shared/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { DateField } from "./DateField";
import { type TaskDraft, toCreateInput, toPatch } from "./draft";
import { PersonPicker } from "./PersonPicker";
import { nextCodeOf, ProjectPicker } from "./ProjectPicker";
import {
  charCount,
  fileTooLargeMessage,
  isMissingError,
  isTooLarge,
  SUBTASK_MAX,
  type TaskFormErrors,
  type TaskFormField,
  validateTaskForm,
} from "./validate";

let rowSeq = 0;
const newKey = () => `n${++rowSeq}`;

/** Trường lỗi từ Rust (`AppError.field`) → ô hiện lỗi trong form. */
const SERVER_FIELD: Record<string, TaskFormField> = {
  projectId: "projectId",
  title: "title",
  assigneeId: "assigneeId",
  creatorId: "creatorId",
  startDate: "startDate",
  dueDate: "startDate",
  subtasks: "subtasks",
  files: "files",
  filePaths: "files",
  addFilePaths: "files",
};

export function FormHeader({ heading }: { heading: string }) {
  return (
    <div className="flex flex-none items-center gap-3 border-b px-6 pt-[18px] pb-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <DialogTitle className="truncate" style={{ fontSize: 19 }}>
          {heading}
        </DialogTitle>
        <span className="text-xs font-semibold text-muted">
          Trường có dấu <span className="text-danger">*</span> là bắt buộc
        </span>
      </div>
      <DialogClose asChild>
        <Button
          variant="secondary"
          size="icon-sm"
          className="ml-auto size-[34px] text-muted hover:text-ink"
          aria-label="Đóng"
          title="Đóng"
        >
          <XIcon />
        </Button>
      </DialogClose>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required = false,
  error,
  wide = false,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const text = (
    <>
      {label}
      {required && <span className="text-danger"> *</span>}
    </>
  );
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", wide && "col-span-2")}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-label">
          {text}
        </label>
      ) : (
        <span className="text-label">{text}</span>
      )}
      {children}
      {error && (
        <span role="alert" className="text-xs font-bold text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

function RemoveButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex size-5 flex-none items-center justify-center rounded-full opacity-70 hover:bg-line hover:opacity-100"
    >
      <XIcon className="size-3" strokeWidth={2.6} aria-hidden="true" />
    </button>
  );
}

function FileRow({ name, size, onRemove }: { name: string; size: number; onRemove: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-field bg-surface2 py-[7px] pr-2 pl-2.5 text-[13.5px] font-bold">
      <FileIcon className="size-[15px] flex-none text-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="text-[12.5px] font-semibold whitespace-nowrap text-muted">
        {formatFileSize(size)}
      </span>
      <RemoveButton title="Gỡ tệp" onClick={onRemove} />
    </div>
  );
}

function CodeHint({ lead, code, tail }: { lead: string; code: string; tail: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-bold text-ink2">
      <HashIcon className="size-[15px] flex-none text-muted" aria-hidden="true" />
      <span className="truncate">
        {lead} <b className="font-extrabold text-ink">{code}</b> {tail}
      </span>
    </span>
  );
}

interface Reject {
  key: string;
  name: string;
  size: number;
}

/**
 * Thân form SC-4 (11 trường đúng thứ tự docs/02 §3). `task` null = tạo mới.
 * Lỗi "thiếu" hiện sau lần bấm lưu đầu; lỗi "sai" (quá dài, ngày) hiện ngay; lỗi Rust theo `field`.
 */
export function TaskForm({
  heading,
  task,
  initial,
  projects,
  onClose,
}: {
  heading: string;
  task: TaskDetail | null;
  initial: TaskDraft;
  projects: ProjectSummary[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const uid = useId();
  const formId = `${uid}-form`;
  const titleRef = useRef<HTMLInputElement>(null);
  const [d, setD] = useState(initial);
  const [subText, setSubText] = useState("");
  const [rejects, setRejects] = useState<Reject[]>([]);
  const [picking, setPicking] = useState(false);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<TaskFormErrors>({});
  const isEdit = task !== null;

  useEffect(() => {
    if (!isEdit) titleRef.current?.focus();
  }, [isEdit]);

  const set = (patch: Partial<TaskDraft>) => {
    setD((p) => ({ ...p, ...patch }));
    setServerErrors({});
  };

  const client = validateTaskForm({
    projectId: d.projectId,
    title: d.title,
    creatorId: d.creatorId,
    startDate: d.startDate,
    dueDate: d.dueDate,
    subtasks: [...d.subtasks.map((s) => s.title), subText],
  });
  const errors: TaskFormErrors = { ...serverErrors };
  for (const [field, msg] of Object.entries(client) as [TaskFormField, string][]) {
    if (tried || !isMissingError(msg)) errors[field] = msg;
  }

  const save = useMutation({
    mutationFn: async (): Promise<TaskDetail | null> => {
      if (!task) return api.createTask(toCreateInput(d, subText));
      const patch = toPatch(task, d, subText);
      return Object.keys(patch).length > 0 ? api.updateTask({ id: task.id, patch }) : null;
    },
    onSuccess: (res) => {
      if (res) {
        qc.setQueryData(queryKeys.task(res.id), res);
        void invalidateTaskData(qc);
        toast.success(isEdit ? `Đã lưu ${res.code}` : `Đã tạo ${res.code}`);
      }
      onClose();
    },
    onError: (e) => {
      if (!isAppError(e, "VALIDATION")) return; // lỗi khác: MutationCache đã hiện toast
      const field = e.field ? SERVER_FIELD[e.field] : undefined;
      if (!field) {
        toast.error(e.message);
        return;
      }
      const next: TaskFormErrors = {};
      next[field] = e.message;
      setServerErrors(next);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(client).length > 0 || save.isPending) return;
    save.mutate();
  };

  const addSubtask = () => {
    const t = subText.trim();
    if (!t || charCount(t) > SUBTASK_MAX) return;
    set({ subtasks: [...d.subtasks, { key: newKey(), id: null, title: t, isDone: false }] });
    setSubText("");
  };

  const chooseFiles = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await api.pickFiles();
      const ok = picked.filter((f) => !isTooLarge(f.sizeBytes));
      const bad = picked.filter((f) => isTooLarge(f.sizeBytes));
      if (ok.length) {
        setD((p) => ({
          ...p,
          newFiles: [
            ...p.newFiles,
            ...ok.filter((f) => !p.newFiles.some((x) => x.path === f.path)),
          ],
        }));
      }
      if (bad.length) {
        setRejects((r) => [
          ...bad.map((f) => ({ key: newKey(), name: f.fileName, size: f.sizeBytes })),
          ...r,
        ]);
      }
      setServerErrors({});
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPicking(false);
    }
  };

  const project = projects.find((p) => p.id === d.projectId);
  const nextCode = project ? nextCodeOf(project) : null;
  const kept = d.attachments.filter((a) => !d.removedAttachmentIds.includes(a.id));
  const fileCount = kept.length + d.newFiles.length;
  const id = (name: string) => `${uid}-${name}`;

  return (
    <>
      <FormHeader heading={heading} />
      <form
        id={formId}
        onSubmit={onSubmit}
        noValidate
        className="min-h-0 flex-1 overflow-y-auto px-6 pt-[18px] pb-6"
      >
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-4">
          <Field label="Dự án" required htmlFor={id("project")} error={errors.projectId} wide>
            <div className="flex min-w-0 items-center gap-3.5">
              <ProjectPicker
                id={id("project")}
                projects={projects}
                value={d.projectId}
                onChange={(projectId) => set({ projectId })}
                showNextCode={!task}
                footnote={
                  task
                    ? "Đổi dự án không làm đổi mã việc"
                    : nextCode
                      ? "Mã bên phải là mã việc kế tiếp của từng dự án"
                      : undefined
                }
                invalid={!!errors.projectId}
                className="w-[340px] flex-none"
              />
              {task ? (
                <CodeHint lead="Mã" code={task.code} tail="(giữ nguyên khi đổi dự án)" />
              ) : (
                nextCode && <CodeHint lead="Mã dự kiến:" code={nextCode} tail="(ghi khi lưu)" />
              )}
            </div>
          </Field>

          <Field label="Tiêu đề" required htmlFor={id("title")} error={errors.title} wide>
            <Input
              ref={titleRef}
              id={id("title")}
              value={d.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Ví dụ: Hoàn thiện trang Liên hệ"
              aria-invalid={!!errors.title || undefined}
              className="h-11 text-[15.5px]"
            />
          </Field>

          <Field label="Mô tả" htmlFor={id("desc")} wide>
            <Textarea
              id={id("desc")}
              value={d.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Mô tả việc cần làm (không bắt buộc)"
              className="field-sizing-fixed h-24 resize-none leading-normal"
            />
          </Field>

          <Field label="Người phụ trách" htmlFor={id("assignee")} error={errors.assigneeId}>
            <PersonPicker
              id={id("assignee")}
              value={d.assigneeId}
              onChange={(assigneeId) => set({ assigneeId })}
              allowUnassigned
              footnote="Chỉ hiện nhân viên đang làm việc"
              invalid={!!errors.assigneeId}
            />
          </Field>

          <Field label="Người tạo" required htmlFor={id("creator")} error={errors.creatorId}>
            <PersonPicker
              id={id("creator")}
              value={d.creatorId}
              onChange={(creatorId) => set({ creatorId })}
              footnote="Người tạo là người yêu cầu việc, không để trống"
              invalid={!!errors.creatorId}
            />
          </Field>

          <Field label="Trạng thái" wide>
            <ToggleGroup
              type="single"
              spacing={1}
              value={d.status}
              onValueChange={(v) => {
                const status = STATUS_ORDER.find((s) => s === v);
                if (status) set({ status });
              }}
              aria-label="Trạng thái"
              className="flex-wrap gap-1.5"
            >
              {STATUS_ORDER.map((s) => {
                const m = STATUS_META[s];
                const on = d.status === s;
                return (
                  <ToggleGroupItem
                    key={s}
                    value={s}
                    className="h-[34px] rounded-full bg-surface2 px-3 text-[13px] font-extrabold text-muted"
                    style={
                      on
                        ? { background: m.bg, color: m.fg, boxShadow: `inset 0 0 0 2px ${m.fg}` }
                        : undefined
                    }
                  >
                    <StatusIcon status={s} className="size-[15px]" />
                    {m.label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </Field>

          {statusHasNote(d.status) && (
            <Field
              label={
                <>
                  {statusNoteLabel(d.status)}{" "}
                  <span className="font-semibold">(không bắt buộc)</span>
                </>
              }
              htmlFor={id("note")}
              wide
            >
              <Input
                id={id("note")}
                value={d.statusNote}
                onChange={(e) => set({ statusNote: e.target.value })}
                placeholder={
                  d.status === "cancelled"
                    ? "Ví dụ: Khách không cần nữa"
                    : "Ví dụ: Chờ khách gửi nội dung"
                }
              />
            </Field>
          )}

          <Field label="Ưu tiên" wide>
            <ToggleGroup
              type="single"
              spacing={1}
              value={String(d.priority)}
              onValueChange={(v) => {
                const priority = PRIORITY_ORDER.find((p) => String(p) === v);
                if (priority) set({ priority });
              }}
              aria-label="Ưu tiên"
              className="gap-1 rounded-[14px] bg-surface2 p-1"
            >
              {PRIORITY_ORDER.map((p) => (
                <ToggleGroupItem
                  key={p}
                  value={String(p)}
                  className="h-[30px] rounded-[10px] px-4 text-[13px] font-extrabold data-[state=on]:bg-surface data-[state=on]:shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                  style={{ color: PRIORITY_META[p].color }}
                >
                  <Flag className="size-[15px]" aria-hidden="true" />
                  {PRIORITY_META[p].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field label="Ngày bắt đầu" htmlFor={id("start")} error={errors.startDate}>
            <DateField
              id={id("start")}
              value={d.startDate}
              onChange={(startDate) => set({ startDate })}
              invalid={!!errors.startDate}
            />
          </Field>

          <Field label="Hạn chót" htmlFor={id("due")}>
            <DateField
              id={id("due")}
              value={d.dueDate}
              onChange={(dueDate) => set({ dueDate })}
              invalid={!!errors.startDate}
              clearLabel="Xoá hạn chót"
            />
          </Field>

          <Field
            label={d.subtasks.length ? `Việc con · ${d.subtasks.length}` : "Việc con"}
            htmlFor={id("sub")}
            error={errors.subtasks}
          >
            <div className="flex flex-col gap-1.5">
              {d.subtasks.map((s) => (
                <div
                  key={s.key}
                  className="flex min-w-0 items-center gap-2.5 rounded-field bg-surface2 py-[7px] pr-2 pl-2.5 text-[13.5px] font-bold"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 flex-none items-center justify-center rounded-[5px] text-white",
                      s.isDone ? "bg-[#4dbb7f]" : "shadow-[inset_0_0_0_2px_var(--line)]",
                    )}
                  >
                    {s.isDone && <CheckIcon className="size-[11px]" strokeWidth={3.4} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  <RemoveButton
                    title="Xoá việc con"
                    onClick={() => set({ subtasks: d.subtasks.filter((x) => x.key !== s.key) })}
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  id={id("sub")}
                  value={subText}
                  onChange={(e) => {
                    setSubText(e.target.value);
                    setServerErrors({});
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                  placeholder="Thêm việc con rồi nhấn Enter"
                  aria-invalid={!!errors.subtasks || undefined}
                  className="h-9"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                  disabled={!subText.trim()}
                  onClick={addSubtask}
                >
                  Thêm
                </Button>
              </div>
            </div>
          </Field>

          <Field
            label={fileCount ? `Tệp đính kèm · ${fileCount}` : "Tệp đính kèm"}
            error={errors.files}
          >
            <div className="flex flex-col gap-1.5">
              {kept.map((a) => (
                <FileRow
                  key={`a${a.id}`}
                  name={a.fileName}
                  size={a.sizeBytes}
                  onRemove={() => set({ removedAttachmentIds: [...d.removedAttachmentIds, a.id] })}
                />
              ))}
              {d.newFiles.map((f) => (
                <FileRow
                  key={f.path}
                  name={f.fileName}
                  size={f.sizeBytes}
                  onRemove={() => set({ newFiles: d.newFiles.filter((x) => x.path !== f.path) })}
                />
              ))}
              {rejects.map((r) => (
                <div
                  key={r.key}
                  role="alert"
                  className="flex min-w-0 items-center gap-2.5 rounded-field bg-danger-bg py-[7px] pr-2 pl-2.5 text-[13.5px] font-bold text-danger"
                >
                  <TriangleAlertIcon className="size-[15px] flex-none" aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">
                      {r.name} · {formatFileSize(r.size)}
                    </span>
                    <span className="text-xs font-bold">{fileTooLargeMessage(r.name)}</span>
                  </div>
                  <RemoveButton
                    title="Đóng thông báo"
                    onClick={() => setRejects((x) => x.filter((y) => y.key !== r.key))}
                  />
                </div>
              ))}
              <div className="flex items-center gap-2.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void chooseFiles()}
                  disabled={picking}
                >
                  <PaperclipIcon />
                  Chọn tệp
                </Button>
                <span className="text-xs font-semibold text-muted">Tối đa 50 MB mỗi tệp</span>
              </div>
            </div>
          </Field>
        </div>
      </form>
      <div className="flex flex-none items-center gap-2.5 border-t px-6 py-3.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-bold text-muted">
          <InfoIcon className="size-[15px] flex-none" aria-hidden="true" />
          <span className="truncate">
            {task
              ? `Mã ${task.code} · Ngày tạo ${formatDateTime(task.createdAt)}`
              : "Mã việc và ngày tạo được ghi tự động khi lưu"}
          </span>
        </span>
        <Button variant="outline" className="ml-auto" onClick={onClose}>
          Huỷ
        </Button>
        <Button type="submit" form={formId} disabled={save.isPending}>
          {task ? "Lưu" : "Tạo việc"}
        </Button>
      </div>
    </>
  );
}
