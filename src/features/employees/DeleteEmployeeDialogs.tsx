import { useState } from "react";
import { errorMessage, isAppError } from "@/shared/api/errors";
import type { EmployeeRow, Id } from "@/shared/api/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { toast } from "@/shared/ui/sonner";
import { useDeleteEmployee } from "./use-employees";

/**
 * Xoá nhân viên (R-05): người đang phụ trách việc hoặc backend báo EMPLOYEE_IN_USE → hộp
 * "Không thể xoá {họ tên}" (Đóng · Chuyển sang Đã nghỉ); còn lại → xác nhận "Xoá {họ tên}?".
 */
export function DeleteEmployeeDialogs({
  open,
  employee,
  onClose,
  onRetire,
}: {
  open: boolean;
  employee: EmployeeRow | null;
  onClose: () => void;
  onRetire: (e: EmployeeRow) => void;
}) {
  const del = useDeleteEmployee();
  const [inUseId, setInUseId] = useState<Id | null>(null);
  const name = employee?.fullName ?? "";
  const blocked = employee !== null && (employee.openCount > 0 || inUseId === employee.id);

  const confirm = () => {
    if (!employee) return;
    del.mutate(employee.id, {
      onSuccess: () => {
        toast.success(`Đã xoá ${employee.fullName}`);
        onClose();
      },
      onError: (err) => {
        if (isAppError(err, "EMPLOYEE_IN_USE")) {
          setInUseId(employee.id);
          return;
        }
        toast.error(errorMessage(err));
        onClose();
      },
    });
  };

  return (
    <>
      <ConfirmDialog
        open={open && !blocked}
        onOpenChange={(o) => !o && onClose()}
        title={`Xoá ${name}?`}
        description={`${name} chưa có việc và bình luận nào nên có thể xoá hẳn khỏi danh mục. Thao tác này không hoàn tác được.`}
        confirmLabel="Xoá nhân viên"
        pending={del.isPending}
        onConfirm={confirm}
      />
      <AlertDialog open={open && blocked} onOpenChange={(o) => !o && onClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Không thể xoá {name}</AlertDialogTitle>
            <AlertDialogDescription>
              {name} đã có việc hoặc bình luận nên không xoá được, chỉ có thể chuyển sang Đã nghỉ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Đóng</AlertDialogCancel>
            {employee?.status === "active" && (
              <AlertDialogAction onClick={() => onRetire(employee)}>
                Chuyển sang Đã nghỉ
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
