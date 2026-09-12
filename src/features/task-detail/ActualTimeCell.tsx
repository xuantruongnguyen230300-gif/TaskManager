import { PencilIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isAppError } from "@/shared/api/errors";
import type { TaskDetail } from "@/shared/api/types";
import { formatDateTime } from "@/shared/lib/date";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ACTUAL_FORMAT_ERROR, ACTUAL_RANGE_ERROR, parseDateTimeInput } from "./format";
import { useUpdateTask } from "./use-task-detail";

/**
 * Ô Bắt đầu / Kết thúc thực tế sửa tại chỗ (docs/02 §4): gõ `dd/MM/yyyy HH:mm`, Enter = lưu,
 * Esc = huỷ, "Xoá giá trị" = để trống. Kiểm tra R-06 trước khi gửi.
 */
export function ActualTimeCell({
  task,
  field,
}: {
  task: TaskDetail;
  field: "actualStartAt" | "actualEndAt";
}) {
  const label = field === "actualStartAt" ? "Bắt đầu thực tế" : "Kết thúc thực tế";
  const current = task[field];
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const begin = () => {
    setText(formatDateTime(current));
    setError("");
    setEditing(true);
  };

  const save = (raw: string) => {
    const v = raw.trim();
    const ms = v ? parseDateTimeInput(v) : null;
    if (v && ms === null) {
      setError(ACTUAL_FORMAT_ERROR);
      return;
    }
    if (v === formatDateTime(current)) {
      setEditing(false);
      return;
    }
    const start = field === "actualStartAt" ? ms : task.actualStartAt;
    const end = field === "actualEndAt" ? ms : task.actualEndAt;
    if (start !== null && end !== null && end < start) {
      setError(ACTUAL_RANGE_ERROR);
      return;
    }
    update.mutate(
      {
        id: task.id,
        patch: field === "actualStartAt" ? { actualStartAt: ms } : { actualEndAt: ms },
      },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => {
          if (isAppError(e, "VALIDATION")) setError(e.message);
        },
      },
    );
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={begin}
        title="Bấm để sửa"
        className="flex min-w-0 flex-col gap-[3px] rounded-[12px] px-2.5 py-[7px] text-left hover:bg-surface2"
      >
        <span className="flex w-full items-center gap-1.5 text-[11.5px] font-extrabold text-muted">
          {label}
          <PencilIcon className="ml-auto size-3" aria-hidden="true" />
        </span>
        <span className="text-[13.5px] font-bold">
          {current === null ? "—" : formatDateTime(current)}
        </span>
      </button>
    );
  }

  return (
    <div
      data-inline-edit
      className="col-span-2 flex min-w-0 flex-col gap-[3px] rounded-[12px] bg-surface2 px-2.5 py-[7px]"
    >
      <span className="text-[11.5px] font-extrabold text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save(text);
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          placeholder="dd/MM/yyyy HH:mm"
          aria-label={label}
          aria-invalid={!!error || undefined}
          className="h-8 w-[190px] flex-none bg-surface text-[13px]"
        />
        <Button
          size="sm"
          variant="secondary"
          className="bg-surface px-3"
          disabled={update.isPending}
          onClick={() => save(text)}
        >
          Lưu
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="px-3"
          disabled={update.isPending || current === null}
          onClick={() => save("")}
        >
          Xoá giá trị
        </Button>
        <button
          type="button"
          title="Huỷ sửa"
          aria-label="Huỷ sửa"
          onClick={() => setEditing(false)}
          className="ml-auto inline-flex size-[22px] flex-none items-center justify-center rounded-full text-muted hover:bg-danger-bg hover:text-danger"
        >
          <XIcon className="size-3" strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs font-bold text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
