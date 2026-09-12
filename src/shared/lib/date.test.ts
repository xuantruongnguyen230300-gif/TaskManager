import { describe, expect, it } from "vitest";
import { formatShortDate, isOverdue, longDateLabel, overdueDays, weekRangeLabel } from "./date";
import { initials, progressLabel } from "./format";

const NOW = new Date(2026, 8, 12, 10, 0); // Thứ Bảy 12/09/2026 10:00

describe("date", () => {
  it("ngày rút gọn", () => {
    expect(formatShortDate("2026-09-12", NOW)).toBe("Hôm nay");
    expect(formatShortDate("2026-09-13", NOW)).toBe("Mai");
    expect(formatShortDate("2026-09-20", NOW)).toBe("20/09");
    expect(formatShortDate("2027-01-02", NOW)).toBe("02/01/2027");
  });

  it("quá hạn", () => {
    expect(overdueDays("2026-09-10", NOW)).toBe(2);
    expect(isOverdue({ status: "in_progress", dueDate: "2026-09-11" }, NOW)).toBe(true);
    expect(isOverdue({ status: "done", dueDate: "2026-09-11" }, NOW)).toBe(false);
    expect(isOverdue({ status: "new", dueDate: "2026-09-12" }, NOW)).toBe(false);
  });

  it("nhãn tuần và ngày", () => {
    expect(weekRangeLabel(NOW)).toBe("T2 07/09 – CN 13/09");
    expect(longDateLabel(NOW)).toBe("Thứ Bảy, 12/09/2026");
  });

  it("chữ tắt và tiến độ", () => {
    expect(initials("Trần Minh Quân")).toBe("MQ");
    expect(initials("Phạm Đức Anh")).toBe("ĐA");
    expect(progressLabel(3, 4)).toBe("3/4 (75%)");
    expect(progressLabel(0, 0)).toBe("—");
  });
});
