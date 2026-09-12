/** Chữ hiển thị của SC-5: dòng Lịch sử (docs/02 §7) và ô sửa tại chỗ ngày giờ thực tế. */
import type { HistoryEntry, HistoryField } from "@/shared/api/types";

type ChangeField = Exclude<
  HistoryField,
  "created" | "description" | "attachment_added" | "attachment_removed" | "deleted" | "restored"
>;

const FIELD_LABEL: Record<ChangeField, string> = {
  title: "Tiêu đề",
  project: "Dự án",
  status: "Trạng thái",
  priority: "Ưu tiên",
  assignee: "Người phụ trách",
  creator: "Người tạo",
  start_date: "Ngày bắt đầu",
  due_date: "Hạn chót",
  actual_start: "Bắt đầu thực tế",
  actual_end: "Kết thúc thực tế",
};

const EMPTY = "(trống)";

export type HistoryLine =
  | { kind: "text"; text: string }
  | { kind: "change"; label: string; from: string; to: string };

/** Giá trị trong DB đã là chữ hiển thị sẵn; trống → "(trống)". */
export function historyLine(h: HistoryEntry): HistoryLine {
  switch (h.field) {
    case "created":
      return { kind: "text", text: "Tạo việc" };
    case "description":
      return { kind: "text", text: "Mô tả: đã sửa" };
    case "attachment_added":
      return { kind: "text", text: `Thêm tệp: ${h.newValue ?? h.oldValue ?? ""}` };
    case "attachment_removed":
      return { kind: "text", text: `Gỡ tệp: ${h.oldValue ?? h.newValue ?? ""}` };
    case "deleted":
      return { kind: "text", text: "Chuyển vào Thùng rác" };
    case "restored":
      return { kind: "text", text: "Khôi phục từ Thùng rác" };
    default:
      return {
        kind: "change",
        label: FIELD_LABEL[h.field],
        from: h.oldValue ?? EMPTY,
        to: h.newValue ?? EMPTY,
      };
  }
}

export const ACTUAL_FORMAT_ERROR =
  "Nhập đủ ngày giờ theo dạng dd/MM/yyyy HH:mm, ví dụ 08/09/2026 09:10.";
export const ACTUAL_RANGE_ERROR = "Kết thúc thực tế phải sau hoặc bằng bắt đầu thực tế.";

const DATETIME_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;

/** "dd/MM/yyyy HH:mm" (giờ máy) → ms; sai định dạng hoặc ngày không có thật → null. */
export function parseDateTimeInput(input: string): number | null {
  const m = DATETIME_RE.exec(input.trim());
  if (!m) return null;
  const [dd, mo, yy, hh, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || dd < 1 || hh > 23 || mi > 59) return null;
  const d = new Date(yy, mo - 1, dd, hh, mi);
  if (d.getMonth() !== mo - 1 || d.getDate() !== dd) return null;
  return d.getTime();
}
