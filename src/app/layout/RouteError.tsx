import type { ErrorComponentProps } from "@tanstack/react-router";
import { errorMessage } from "@/shared/api/errors";
import { Button } from "@/shared/ui/button";

/** Lỗi render của một màn: báo lỗi + nút "Tải lại". */
export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card bg-surface p-6 shadow-card">
      <div className="text-card-title">Không hiển thị được màn này</div>
      <div className="text-sub">{errorMessage(error)}</div>
      <Button
        variant="secondary"
        onClick={() => {
          reset();
          window.location.reload();
        }}
      >
        Tải lại
      </Button>
    </div>
  );
}
