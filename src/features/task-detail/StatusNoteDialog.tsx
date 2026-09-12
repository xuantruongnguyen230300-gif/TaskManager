import { useEffect, useId, useState } from "react";
import { STATUS_META, statusNoteLabel } from "@/shared/lib/status";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { StatusIcon } from "@/shared/ui/status-chip";
import { Textarea } from "@/shared/ui/textarea";

/**
 * Hộp hỏi "Lý do chờ" / "Lý do huỷ" (docs/02 §5, §9) khi đổi trạng thái ở SC-5 hoặc kéo thẻ Kanban.
 * Không bắt buộc nhập. Huỷ/Esc → `onCancel` (trạng thái không đổi, thẻ Kanban về cột cũ).
 * Ctrl+Enter = Xác nhận.
 * DÙNG CHUNG: F2 sở hữu (được chỉnh giao diện, GIỮ NGUYÊN props); F3 import cho Kanban.
 */
export function StatusNoteDialog({
  open,
  status,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  status: "waiting" | "cancelled";
  pending?: boolean;
  /** lý do đã trim; chuỗi rỗng = không nhập */
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const confirm = () => {
    if (!pending) onConfirm(note.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="gap-3.5 px-6 py-[22px] sm:max-w-[460px]"
      >
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <span
            className={cn(
              "flex size-10 flex-none items-center justify-center rounded-nav",
              STATUS_META[status].chipClass,
            )}
          >
            <StatusIcon status={status} className="size-[18px] [stroke-width:2]" />
          </span>
          <DialogTitle style={{ fontSize: 18 }}>{statusNoteLabel(status)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-label">
            Lý do <span className="font-semibold">(không bắt buộc)</span>
          </label>
          <Textarea
            id={inputId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                confirm();
              }
            }}
            placeholder={
              status === "cancelled" ? "Ví dụ: Khách không cần nữa" : "Ví dụ: Chờ khách phản hồi"
            }
            className="field-sizing-fixed h-20 resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Huỷ
          </Button>
          <Button onClick={confirm} disabled={pending}>
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
