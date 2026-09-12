import { useState } from "react";
import { PersonPicker } from "@/features/task-form/PersonPicker";
import { COMMENT_MAX, charCount, MSG } from "@/features/task-form/validate";
import { isAppError } from "@/shared/api/errors";
import { useEmployees, useSettings } from "@/shared/api/queries";
import type { Comment, Id, TaskDetail } from "@/shared/api/types";
import { formatDateTime } from "@/shared/lib/date";
import { Avatar, InactiveBadge } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Textarea } from "@/shared/ui/textarea";
import { useCommentActions } from "./use-task-detail";

/** Tab Bình luận: cũ → mới; thêm (tác giả mặc định "Tôi", chỉ người đang làm việc); xoá có xác nhận. */
export function CommentsTab({ task }: { task: TaskDetail }) {
  const { add, remove } = useCommentActions(task.id);
  const { data: settings } = useSettings();
  const { data: employees } = useEmployees("all");
  const [author, setAuthor] = useState<Id | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [target, setTarget] = useState<Comment | null>(null);

  const selfId = settings?.selfEmployeeId ?? employees?.find((e) => e.isSelf)?.id ?? null;
  const authorId = author ?? selfId;

  const submit = () => {
    const text = body.trim();
    if (!text || authorId === null || add.isPending) return;
    if (charCount(text) > COMMENT_MAX) {
      setError(MSG.commentTooLong);
      return;
    }
    add.mutate(
      { taskId: task.id, authorId, body: text },
      {
        onSuccess: () => {
          setBody("");
          setError("");
        },
        onError: (e) => {
          if (isAppError(e, "VALIDATION")) setError(e.message);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {task.comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar name={c.authorName} color={c.authorColor} className="mt-0.5" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-extrabold">{c.authorName}</span>
              {c.authorInactive && <InactiveBadge />}
              <span className="text-[12.5px] font-semibold whitespace-nowrap text-muted">
                {formatDateTime(c.createdAt)}
              </span>
              <button
                type="button"
                onClick={() => setTarget(c)}
                className="ml-auto text-xs font-extrabold text-danger hover:underline"
              >
                Xoá
              </button>
            </div>
            <div className="rounded-[4px_16px_16px_16px] bg-surface2 px-3 py-[9px] text-[13.5px] leading-normal font-semibold break-words whitespace-pre-wrap text-ink2">
              {c.body}
            </div>
          </div>
        </div>
      ))}
      {task.comments.length === 0 && (
        <span className="text-xs font-semibold text-muted">Chưa có bình luận.</span>
      )}

      <div className="flex flex-col gap-2 rounded-2xl p-3 shadow-[inset_0_0_0_1.5px_var(--line)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-muted">Tác giả</span>
          <PersonPicker
            size="sm"
            value={authorId}
            onChange={(id) => id !== null && setAuthor(id)}
            ariaLabel="Tác giả bình luận"
            className="w-auto max-w-[260px]"
          />
        </div>
        <Textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setError("");
          }}
          placeholder="Viết bình luận hoặc ghi lại tiến độ nhân viên báo"
          aria-label="Nội dung bình luận"
          aria-invalid={!!error || undefined}
          className="field-sizing-fixed h-[72px] resize-none leading-normal"
        />
        {error && (
          <span role="alert" className="text-xs font-bold text-danger">
            {error}
          </span>
        )}
        <div className="flex">
          <Button
            size="sm"
            className="ml-auto"
            disabled={!body.trim() || authorId === null || add.isPending}
            onClick={submit}
          >
            Thêm bình luận
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Xoá bình luận?"
        description="Bình luận sẽ bị xoá hẳn."
        confirmLabel="Xoá"
        pending={remove.isPending}
        onConfirm={() => {
          if (target) remove.mutate(target.id, { onSuccess: () => setTarget(null) });
        }}
      />
    </div>
  );
}
