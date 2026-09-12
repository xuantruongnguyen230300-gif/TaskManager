import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { api } from "@/shared/api/commands";
import { errorMessage } from "@/shared/api/errors";
import { useSettings } from "@/shared/api/queries";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { toast } from "@/shared/ui/sonner";
import { SROW } from "./styles";

/** Dữ liệu: vị trí thư mục · Sao lưu ra .zip · Khôi phục từ .zip (R-10) · (bản dev) nạp dữ liệu mẫu. */
export function DataSection() {
  const qc = useQueryClient();
  const settings = useSettings();
  const [restoreOpen, setRestoreOpen] = useState(false);

  const backup = useMutation({
    mutationFn: () => api.backupToZip(),
    onSuccess: (r) => {
      if (r) toast.success(`Đã sao lưu vào ${r.path}`);
    },
  });
  // Rust mở hộp chọn tệp: huỷ → trả về; thành công → app tự khởi động lại.
  const restore = useMutation({
    mutationFn: () => api.restoreFromZip(),
    onSettled: () => setRestoreOpen(false),
  });
  const seed = useMutation({
    mutationFn: () => api.devSeedSampleData(),
    onSuccess: () => {
      toast.success("Đã nạp dữ liệu mẫu");
      return qc.invalidateQueries();
    },
  });

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <span className="font-extrabold text-[15px]">Vị trí thư mục dữ liệu</span>
        <div className={SROW}>
          <Folder className="flex-none text-muted" />
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="break-all font-extrabold font-mono text-[13px]">
              {settings.data?.dataDir ??
                (settings.isError ? errorMessage(settings.error) : "Đang tải…")}
            </span>
            <span className="text-[12.5px] text-muted">
              Dữ liệu và thư mục tệp đính kèm nằm trong thư mục này.
            </span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <span className="font-extrabold text-[15px]">Sao lưu và khôi phục</span>
        <div className={SROW}>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-extrabold text-sm">Sao lưu ra tệp .zip</span>
            <span className="text-[12.5px] text-muted leading-normal">
              Gồm dữ liệu và toàn bộ tệp đính kèm, lưu vào nơi bạn chọn.
            </span>
          </div>
          <Button size="sm" disabled={backup.isPending} onClick={() => backup.mutate()}>
            {backup.isPending ? "Đang sao lưu…" : "Sao lưu ra .zip"}
          </Button>
        </div>
        <div className={SROW}>
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="font-extrabold text-sm">Khôi phục từ tệp .zip</span>
            <span className="text-[12.5px] text-muted leading-normal">
              Thay toàn bộ dữ liệu hiện tại bằng một bản đã sao lưu. App tự sao lưu bản hiện tại
              trước khi thay.
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="bg-surface"
            onClick={() => setRestoreOpen(true)}
          >
            Khôi phục từ tệp .zip…
          </Button>
        </div>
      </section>

      {import.meta.env.DEV && (
        <section className="flex flex-col gap-2.5">
          <span className="font-extrabold text-[15px]">Dữ liệu mẫu (chỉ bản phát triển)</span>
          <div className={SROW}>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="font-extrabold text-sm">Nạp dữ liệu mẫu</span>
              <span className="text-[12.5px] text-muted leading-normal">
                Thêm nhân viên, dự án và việc giống bản thiết kế để thử app.
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="bg-surface"
              disabled={seed.isPending}
              onClick={() => seed.mutate()}
            >
              Nạp dữ liệu mẫu
            </Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={(open) => !open && !restore.isPending && setRestoreOpen(false)}
        title="Khôi phục dữ liệu từ bản sao lưu?"
        description={
          <span className="flex items-start gap-2.5 rounded-nav bg-danger-bg px-3.5 py-2.5 font-bold text-[13.5px] text-danger leading-normal">
            <TriangleAlert className="mt-px size-[18px] flex-none" />
            Dữ liệu hiện tại sẽ bị thay thế. App tự sao lưu dữ liệu hiện tại trước khi khôi phục và
            sẽ khởi động lại.
          </span>
        }
        confirmLabel="Khôi phục"
        pending={restore.isPending}
        onConfirm={() => restore.mutate()}
      />
    </>
  );
}
