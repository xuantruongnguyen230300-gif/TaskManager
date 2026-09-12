import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "@/shared/api/types";
import { historyLine, parseDateTimeInput } from "./format";

const entry = (e: Partial<HistoryEntry>): HistoryEntry => ({
  id: 1,
  changedAt: 0,
  field: "created",
  oldValue: null,
  newValue: null,
  ...e,
});

describe("SC-5 chữ hiển thị", () => {
  it("dòng lịch sử theo docs/02 §7", () => {
    expect(historyLine(entry({ field: "created", newValue: "WEB-12" }))).toEqual({
      kind: "text",
      text: "Tạo việc",
    });
    expect(historyLine(entry({ field: "description" }))).toEqual({
      kind: "text",
      text: "Mô tả: đã sửa",
    });
    expect(
      historyLine(entry({ field: "priority", oldValue: "Trung bình", newValue: "Cao" })),
    ).toEqual({ kind: "change", label: "Ưu tiên", from: "Trung bình", to: "Cao" });
    expect(historyLine(entry({ field: "due_date", newValue: "15/09/2026" }))).toEqual({
      kind: "change",
      label: "Hạn chót",
      from: "(trống)",
      to: "15/09/2026",
    });
    expect(historyLine(entry({ field: "attachment_removed", oldValue: "bao-gia.pdf" }))).toEqual({
      kind: "text",
      text: "Gỡ tệp: bao-gia.pdf",
    });
  });

  it("đọc ngày giờ dd/MM/yyyy HH:mm", () => {
    expect(parseDateTimeInput("08/09/2026 09:10")).toBe(new Date(2026, 8, 8, 9, 10).getTime());
    expect(parseDateTimeInput(" 8/9/2026 9:05 ")).toBe(new Date(2026, 8, 8, 9, 5).getTime());
    expect(parseDateTimeInput("08/09 09:10")).toBeNull();
    expect(parseDateTimeInput("31/02/2026 10:00")).toBeNull();
    expect(parseDateTimeInput("08/09/2026 24:00")).toBeNull();
  });
});
