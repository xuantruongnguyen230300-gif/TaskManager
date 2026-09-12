import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Panel Chi tiết việc (SC-5) theo URL `?task=<id>` — giữ nguyên route và search hiện tại.
 * Mở từ bất kỳ dòng/thẻ việc nào: `const { openTask } = useTaskPanel(); openTask(row.id)`.
 */
export function useTaskPanel() {
  const navigate = useNavigate();
  const { task } = useSearch({ strict: false });

  const openTask = useCallback(
    (id: number) => {
      navigate({ to: ".", search: (prev) => ({ ...prev, task: id }) });
    },
    [navigate],
  );

  const closeTask = useCallback(() => {
    navigate({ to: ".", search: (prev) => ({ ...prev, task: undefined }) });
  }, [navigate]);

  return { taskId: task ?? null, openTask, closeTask };
}
