import { FileIcon } from "lucide-react";
import { useState } from "react";
import type { Attachment, TaskDetail } from "@/shared/api/types";
import { formatDateTime } from "@/shared/lib/date";
import { formatFileSize } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { useAttachmentActions } from "./use-task-detail";

function extOf(name: string): string | null {
  const i = name.lastIndexOf(".");
  return i > 0 && i < name.length - 1 ? name.slice(i + 1, i + 5).toUpperCase() : null;
}

/** Tab Tệp: Mở (ứng dụng mặc định của Windows) · Gỡ (có xác nhận). Thêm tệp qua form Sửa. */
export function FilesTab({ task }: { task: TaskDetail }) {
  const { open, remove } = useAttachmentActions(task.id);
  const [target, setTarget] = useState<Attachment | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {task.attachments.map((a) => {
        const ext = extOf(a.fileName);
        return (
          <div
            key={a.id}
            className="flex min-w-0 items-center gap-2.5 rounded-nav bg-surface2 px-2.5 py-[9px]"
          >
            <div className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-surface text-[10px] font-extrabold text-hero-ink">
              {ext ?? <FileIcon className="size-4" aria-hidden="true" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-extrabold">{a.fileName}</span>
              <span className="truncate text-[12.5px] font-semibold text-muted">
                {formatFileSize(a.sizeBytes)} · thêm lúc {formatDateTime(a.createdAt)}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="bg-surface px-3"
              onClick={() => open.mutate(a.id)}
            >
              Mở
            </Button>
            <Button size="sm" variant="outline" className="px-3" onClick={() => setTarget(a)}>
              Gỡ
            </Button>
          </div>
        );
      })}
      {task.attachments.length === 0 && (
        <span className="text-xs font-semibold text-muted">Chưa có tệp đính kèm.</span>
      )}
      <span className="text-xs font-semibold text-muted">
        Thêm tệp trong form Sửa việc (tối đa 50 MB mỗi tệp).
      </span>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Gỡ tệp “${target?.fileName ?? ""}”?`}
        description="Tệp sẽ bị gỡ khỏi việc này."
        confirmLabel="Gỡ tệp"
        pending={remove.isPending}
        onConfirm={() => {
          if (target) remove.mutate(target.id, { onSuccess: () => setTarget(null) });
        }}
      />
    </div>
  );
}
