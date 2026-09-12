import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/commands";
import { queryKeys } from "@/shared/api/query-keys";

/** SC-1: 4 số, Cần chú ý, Theo nhân viên (tính ở Rust — 03 Q1). */
export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: api.getDashboard });
}
