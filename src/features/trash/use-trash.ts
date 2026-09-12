import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/commands";
import { invalidateTaskData, queryKeys } from "@/shared/api/query-keys";
import type { TrashRow } from "@/shared/api/types";
import { toast } from "@/shared/ui/sonner";

/** SC-8: việc trong Thùng rác (Rust dọn việc quá 30 ngày trước khi trả về). */
export function useTrash() {
  return useQuery({ queryKey: queryKeys.trash, queryFn: api.listTrash });
}

/** Khôi phục / Xoá vĩnh viễn / Dọn sạch — toast đúng câu 02 §9. */
export function useTrashActions(handlers: { onPurged: () => void; onEmptied: () => void }) {
  const qc = useQueryClient();
  const restore = useMutation({
    mutationFn: (row: TrashRow) => api.restoreTask(row.id),
    onSuccess: (_d, row) => {
      toast.success(`Đã khôi phục ${row.code}`);
      return invalidateTaskData(qc);
    },
  });
  const purge = useMutation({
    mutationFn: (row: TrashRow) => api.purgeTask(row.id),
    onSuccess: (_d, row) => {
      handlers.onPurged();
      toast.success(`Đã xoá vĩnh viễn ${row.code}`);
      return invalidateTaskData(qc);
    },
  });
  const empty = useMutation({
    mutationFn: () => api.emptyTrash(),
    onSuccess: () => {
      handlers.onEmptied();
      toast.success("Đã dọn sạch Thùng rác");
      return invalidateTaskData(qc);
    },
  });
  return { restore, purge, empty };
}
