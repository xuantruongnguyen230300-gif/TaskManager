import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { charCount, MSG, SUBTASK_MAX } from "@/features/task-form/validate";
import { isAppError } from "@/shared/api/errors";
import type { TaskDetail } from "@/shared/api/types";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useSubtaskActions } from "./use-task-detail";

export function DeleteX({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex size-[22px] flex-none items-center justify-center rounded-full text-muted hover:bg-danger-bg hover:text-danger"
    >
      <XIcon className="size-3" strokeWidth={2.6} aria-hidden="true" />
    </button>
  );
}

/** Tab Việc con: tick · thêm · xoá (không ghi lịch sử, R-08). */
export function SubtasksTab({ task }: { task: TaskDetail }) {
  const { add, toggle, remove } = useSubtaskActions(task.id);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const subs = task.subtasks;
  const done = subs.filter((s) => s.isDone).length;

  const submit = () => {
    const title = text.trim();
    if (!title || add.isPending) return;
    if (charCount(title) > SUBTASK_MAX) {
      setError(MSG.subtaskTooLong);
      return;
    }
    add.mutate(
      { taskId: task.id, title },
      {
        onSuccess: () => {
          setText("");
          setError("");
        },
        onError: (e) => {
          if (isAppError(e, "VALIDATION")) setError(e.message);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {subs.length > 0 && (
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 flex-1 rounded-full bg-pill">
            <div
              className="h-1.5 rounded-full bg-[#4dbb7f]"
              style={{ width: `${Math.round((done * 100) / subs.length)}%` }}
            />
          </div>
          <span className="text-[12.5px] font-semibold text-muted">
            Xong {done}/{subs.length}
          </span>
        </div>
      )}
      {subs.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-2.5 rounded-[12px] bg-surface2 py-2 pr-2 pl-2.5 text-sm font-bold"
        >
          <button
            type="button"
            aria-pressed={s.isDone}
            aria-label={s.isDone ? `Bỏ đánh dấu xong: ${s.title}` : `Đánh dấu xong: ${s.title}`}
            title={s.isDone ? "Bỏ đánh dấu xong" : "Đánh dấu xong"}
            onClick={() => toggle.mutate(s)}
            className={cn(
              "flex size-[18px] flex-none items-center justify-center rounded-md border-2 text-white",
              s.isDone ? "border-[#4dbb7f] bg-[#4dbb7f]" : "border-muted",
            )}
          >
            {s.isDone && <CheckIcon className="size-[11px]" strokeWidth={3.4} aria-hidden="true" />}
          </button>
          <span className={cn("min-w-0 flex-1 break-words", s.isDone && "text-muted line-through")}>
            {s.title}
          </span>
          <DeleteX title="Xoá việc con" onClick={() => remove.mutate(s)} />
        </div>
      ))}
      {subs.length === 0 && (
        <span className="text-xs font-semibold text-muted">Chưa có việc con.</span>
      )}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Thêm việc con rồi nhấn Enter"
          aria-label="Thêm việc con"
          aria-invalid={!!error || undefined}
          className="h-[38px]"
        />
        <Button
          variant="secondary"
          size="sm"
          className="h-[38px]"
          disabled={!text.trim() || add.isPending}
          onClick={submit}
        >
          Thêm
        </Button>
      </div>
      {error && (
        <span role="alert" className="text-xs font-bold text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
