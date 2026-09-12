import { describe, expect, it } from "vitest";
import type { TaskRow } from "@/shared/api/types";
import { DEFAULT_SORT, filterTaskRows, sortTaskRows } from "./task-filters";

const NOW = new Date(2026, 8, 12, 10, 0); // Thứ Bảy 12/09/2026 (tuần T2 07/09 – CN 13/09)

let seq = 0;
function row(p: Partial<TaskRow>): TaskRow {
  seq += 1;
  return {
    id: seq,
    code: `WEB-${seq}`,
    title: `Việc ${seq}`,
    projectId: 2,
    projectCode: "WEB",
    projectName: "Website",
    projectColor: "#5B8DEF",
    assigneeId: 1,
    assigneeName: "Tôi",
    assigneeColor: "#6E56CF",
    assigneeInactive: false,
    creatorId: 1,
    creatorName: "Tôi",
    status: "new",
    priority: 2,
    startDate: null,
    dueDate: null,
    createdAt: seq,
    subtaskDone: 0,
    subtaskTotal: 0,
    commentCount: 0,
    attachmentCount: 0,
    ...p,
  };
}

const codes = (rows: TaskRow[]) => rows.map((r) => r.code);

describe("filterTaskRows", () => {
  const rows = [
    row({
      code: "WEB-12",
      title: "Đăng nhập bằng email",
      status: "in_progress",
      dueDate: "2026-09-10",
    }),
    row({ code: "WEB-13", status: "done", dueDate: "2026-09-10" }),
    row({ code: "APP-1", projectId: 3, projectCode: "APP", status: "cancelled" }),
    row({
      code: "WEB-14",
      status: "waiting",
      assigneeId: null,
      assigneeName: null,
      dueDate: "2026-09-13",
    }),
    row({ code: "WEB-15", status: "new", assigneeId: 5, dueDate: "2026-09-20" }),
  ];

  it("mặc định chỉ 3 trạng thái đang mở; [] = mọi trạng thái", () => {
    expect(codes(filterTaskRows(rows, {}, NOW))).toEqual(["WEB-12", "WEB-14", "WEB-15"]);
    expect(filterTaskRows(rows, { statuses: [] }, NOW)).toHaveLength(5);
    expect(codes(filterTaskRows(rows, { statuses: ["done", "cancelled"] }, NOW))).toEqual([
      "WEB-13",
      "APP-1",
    ]);
  });

  it("tìm theo mã hoặc tiêu đề, bỏ dấu và hoa thường (R-11)", () => {
    expect(codes(filterTaskRows(rows, { q: "dang nhap" }, NOW))).toEqual(["WEB-12"]);
    expect(codes(filterTaskRows(rows, { q: "web-1", statuses: [] }, NOW))).toEqual([
      "WEB-12",
      "WEB-13",
      "WEB-14",
      "WEB-15",
    ]);
  });

  it("lọc dự án, người phụ trách (có Chưa giao) và hạn", () => {
    const all = { statuses: [] };
    expect(codes(filterTaskRows(rows, { ...all, projects: [3] }, NOW))).toEqual(["APP-1"]);
    expect(codes(filterTaskRows(rows, { assignees: ["unassigned", 5] }, NOW))).toEqual([
      "WEB-14",
      "WEB-15",
    ]);
    expect(codes(filterTaskRows(rows, { ...all, due: "overdue" }, NOW))).toEqual(["WEB-12"]);
    expect(codes(filterTaskRows(rows, { ...all, due: "thisWeek" }, NOW))).toEqual([
      "WEB-12",
      "WEB-13",
      "WEB-14",
    ]);
    expect(codes(filterTaskRows(rows, { ...all, due: "noDue" }, NOW))).toEqual(["APP-1"]);
  });
});

describe("sortTaskRows", () => {
  const rows = [
    row({ code: "WEB-9", createdAt: 300, dueDate: "2026-09-15", assigneeName: "Lan" }),
    row({ code: "WEB-12", createdAt: 100, dueDate: null, assigneeName: null }),
    row({ code: "WEB-10", createdAt: 200, dueDate: "2026-09-11", assigneeName: "Anh" }),
  ];

  it("mặc định Ngày tạo mới nhất trước", () => {
    expect(codes(sortTaskRows(rows, DEFAULT_SORT))).toEqual(["WEB-9", "WEB-10", "WEB-12"]);
  });

  it("mã theo số thứ tự, không theo chữ", () => {
    expect(codes(sortTaskRows(rows, { key: "code", dir: "asc" }))).toEqual([
      "WEB-9",
      "WEB-10",
      "WEB-12",
    ]);
  });

  it("ô trống luôn ở cuối, cả khi giảm dần", () => {
    expect(codes(sortTaskRows(rows, { key: "dueDate", dir: "asc" }))).toEqual([
      "WEB-10",
      "WEB-9",
      "WEB-12",
    ]);
    expect(codes(sortTaskRows(rows, { key: "dueDate", dir: "desc" }))).toEqual([
      "WEB-9",
      "WEB-10",
      "WEB-12",
    ]);
    expect(codes(sortTaskRows(rows, { key: "assignee", dir: "desc" }))).toEqual([
      "WEB-9",
      "WEB-10",
      "WEB-12",
    ]);
  });
});
