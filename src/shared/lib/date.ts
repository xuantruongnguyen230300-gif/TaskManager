/**
 * Ngày giờ hiển thị (giờ máy, tuần bắt đầu thứ Hai).
 * Ngày lịch = "YYYY-MM-DD"; thời điểm = ms UTC.
 * Bảng/thẻ/danh sách: `formatShortDate` ("Hôm nay" / "Mai" / dd/MM). Chi tiết & lịch sử: dd/MM/yyyy (HH:mm).
 */
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfWeek,
} from "date-fns";
import type { TaskStatus } from "@/shared/api/types";
import { isOpenStatus } from "./status";

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** "YYYY-MM-DD" → Date 00:00 giờ máy. */
export function parseIsoDate(iso: string): Date {
  return parseISO(iso);
}

/** Date → "YYYY-MM-DD" theo giờ máy. */
export function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** "Hôm nay" / "Mai" / "dd/MM" (năm hiện tại) / "dd/MM/yyyy" (năm khác). */
export function formatShortDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const d = parseIsoDate(iso);
  if (!isValid(d)) return iso;
  const diff = differenceInCalendarDays(d, now);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Mai";
  return format(d, d.getFullYear() === now.getFullYear() ? "dd/MM" : "dd/MM/yyyy");
}

/** "dd/MM/yyyy" từ ngày lịch. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseIsoDate(iso);
  return isValid(d) ? format(d, "dd/MM/yyyy") : iso;
}

/** "dd/MM/yyyy HH:mm" từ ms. */
export function formatDateTime(ms: number | null | undefined): string {
  if (ms == null) return "";
  return format(new Date(ms), "dd/MM/yyyy HH:mm");
}

/** "dd/MM" từ ms (dòng ngắn trong bảng, ví dụ Ngày tạo). */
export function formatShortDateTime(ms: number | null | undefined, now: Date = new Date()): string {
  if (ms == null) return "";
  const d = new Date(ms);
  return format(d, d.getFullYear() === now.getFullYear() ? "dd/MM" : "dd/MM/yyyy");
}

/** Số ngày quá hạn (0 nếu chưa quá hạn / không có hạn). */
export function overdueDays(dueIso: string | null | undefined, now: Date = new Date()): number {
  if (!dueIso) return 0;
  const d = parseIsoDate(dueIso);
  if (!isValid(d)) return 0;
  return Math.max(0, differenceInCalendarDays(now, d));
}

/** Quá hạn = đang mở và hạn chót < hôm nay. */
export function isOverdue(
  task: { status: TaskStatus; dueDate: string | null },
  now: Date = new Date(),
): boolean {
  return isOpenStatus(task.status) && overdueDays(task.dueDate, now) > 0;
}

/** "Quá hạn 3 ngày" */
export function overdueLabel(days: number): string {
  return `Quá hạn ${days} ngày`;
}

/** "Thứ Bảy, 12/09/2026" */
export function longDateLabel(now: Date = new Date()): string {
  return `${WEEKDAY[now.getDay()]}, ${format(now, "dd/MM/yyyy")}`;
}

/** Tuần này (thứ Hai → Chủ nhật): "T2 07/09 – CN 13/09" */
export function weekRangeLabel(now: Date = new Date()): string {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const sunday = addDays(monday, 6);
  return `T2 ${format(monday, "dd/MM")} – CN ${format(sunday, "dd/MM")}`;
}
