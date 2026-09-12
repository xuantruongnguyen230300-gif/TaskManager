import type { HistoryEntry } from "@/shared/api/types";
import { formatDateTime } from "@/shared/lib/date";
import { historyLine } from "./format";

/** Tab Lịch sử: mới nhất trước (thứ tự do Rust trả), "dd/MM/yyyy HH:mm · …" (docs/02 §7). */
export function HistoryTab({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return <span className="text-xs font-semibold text-muted">Chưa có lịch sử.</span>;
  }
  return (
    <ol className="flex flex-col gap-0.5">
      {history.map((h) => {
        const line = historyLine(h);
        return (
          <li key={h.id} className="flex items-baseline gap-2.5 rounded-[12px] px-2.5 py-2">
            <span className="w-[128px] flex-none text-[12.5px] font-extrabold whitespace-nowrap text-ink2 tabular-nums">
              {formatDateTime(h.changedAt)} ·
            </span>
            <span className="min-w-0 text-[13.5px] leading-normal font-semibold break-words text-ink2">
              {line.kind === "text" ? (
                line.text
              ) : (
                <>
                  {line.label}: <span className="text-muted">{line.from}</span> →{" "}
                  <b className="font-extrabold text-ink">{line.to}</b>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
