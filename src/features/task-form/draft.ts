/**
 * Dữ liệu đang nhập của form SC-4 và cách chuyển thành input của command
 * (`create_task` / `update_task` — patch chỉ gồm trường đã đổi).
 */
import type {
  Attachment,
  CreateTaskInput,
  Id,
  PickedFile,
  Priority,
  ProjectSummary,
  SubtaskDraft,
  TaskDetail,
  TaskPatch,
  TaskStatus,
} from "@/shared/api/types";
import { DEFAULT_PRIORITY } from "@/shared/lib/priority";
import { statusHasNote } from "@/shared/lib/status";
import type { TaskFormDefaults } from "@/shared/stores/ui";

export interface SubtaskRow {
  key: string;
  /** null = dòng mới */
  id: Id | null;
  title: string;
  isDone: boolean;
}

export interface TaskDraft {
  projectId: Id | null;
  title: string;
  description: string;
  assigneeId: Id | null;
  creatorId: Id | null;
  status: TaskStatus;
  statusNote: string;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  subtasks: SubtaskRow[];
  /** tệp mới chọn qua pick_files */
  newFiles: PickedFile[];
  /** chế độ Sửa: tệp cũ đang có */
  attachments: Attachment[];
  removedAttachmentIds: Id[];
}

/** Dự án mặc định: dự án được truyền (đang xem) → "Việc chung" → dự án đầu tiên. */
export function draftForCreate(
  defaults: TaskFormDefaults,
  projects: ProjectSummary[],
  selfId: Id | null,
): TaskDraft {
  const given = projects.find((p) => p.id === defaults.projectId);
  const project = given ?? projects.find((p) => p.isDefault) ?? projects[0];
  return {
    projectId: project?.id ?? null,
    title: "",
    description: "",
    assigneeId: defaults.assigneeId ?? null,
    creatorId: selfId,
    status: defaults.status ?? "new",
    statusNote: "",
    priority: DEFAULT_PRIORITY,
    startDate: null,
    dueDate: null,
    subtasks: [],
    newFiles: [],
    attachments: [],
    removedAttachmentIds: [],
  };
}

export function draftFromTask(t: TaskDetail): TaskDraft {
  return {
    projectId: t.projectId,
    title: t.title,
    description: t.description ?? "",
    assigneeId: t.assigneeId,
    creatorId: t.creatorId,
    status: t.status,
    statusNote: t.statusNote ?? "",
    priority: t.priority,
    startDate: t.startDate,
    dueDate: t.dueDate,
    subtasks: t.subtasks.map((s) => ({
      key: `s${s.id}`,
      id: s.id,
      title: s.title,
      isDone: s.isDone,
    })),
    newFiles: [],
    attachments: t.attachments,
    removedAttachmentIds: [],
  };
}

/** Việc con cuối cùng (kể cả dòng đang gõ dở), bỏ dòng trống. */
function subtaskList(d: TaskDraft, pending: string): { id: Id | null; title: string }[] {
  const rows = d.subtasks.map((s) => ({ id: s.id, title: s.title.trim() }));
  rows.push({ id: null, title: pending.trim() });
  return rows.filter((r) => r.title !== "");
}

function noteOf(d: TaskDraft): string | null {
  return statusHasNote(d.status) ? d.statusNote.trim() || null : null;
}

export function toCreateInput(d: TaskDraft, pending: string): CreateTaskInput {
  if (d.projectId === null || d.creatorId === null) throw new Error("Form chưa hợp lệ");
  return {
    projectId: d.projectId,
    title: d.title.trim(),
    description: d.description.trim() || null,
    assigneeId: d.assigneeId,
    creatorId: d.creatorId,
    status: d.status,
    statusNote: noteOf(d),
    priority: d.priority,
    startDate: d.startDate,
    dueDate: d.dueDate,
    subtasks: subtaskList(d, pending).map((s) => s.title),
    filePaths: d.newFiles.map((f) => f.path),
  };
}

/** Patch chỉ gồm trường thay đổi so với việc gốc (không gửi = giữ nguyên, null = xoá). */
export function toPatch(t: TaskDetail, d: TaskDraft, pending: string): TaskPatch {
  const p: TaskPatch = {};
  if (d.projectId !== null && d.projectId !== t.projectId) p.projectId = d.projectId;
  const title = d.title.trim();
  if (title !== t.title) p.title = title;
  const desc = d.description.trim() || null;
  if (desc !== (t.description?.trim() || null)) p.description = desc;
  if (d.assigneeId !== t.assigneeId) p.assigneeId = d.assigneeId;
  if (d.creatorId !== null && d.creatorId !== t.creatorId) p.creatorId = d.creatorId;
  if (d.priority !== t.priority) p.priority = d.priority;
  if (d.startDate !== t.startDate) p.startDate = d.startDate;
  if (d.dueDate !== t.dueDate) p.dueDate = d.dueDate;

  const note = noteOf(d);
  if (d.status !== t.status) {
    p.status = d.status;
    p.statusNote = note;
  } else if (statusHasNote(d.status) && note !== (t.statusNote ?? null)) {
    p.statusNote = note;
  }

  const subs = subtaskList(d, pending);
  const same =
    subs.length === t.subtasks.length &&
    subs.every((s, i) => s.id === t.subtasks[i]?.id && s.title === t.subtasks[i]?.title);
  if (!same) {
    p.subtasks = subs.map((s): SubtaskDraft => (s.id !== null ? s : { title: s.title }));
  }

  if (d.newFiles.length) p.addFilePaths = d.newFiles.map((f) => f.path);
  if (d.removedAttachmentIds.length) p.removeAttachmentIds = d.removedAttachmentIds;
  return p;
}
