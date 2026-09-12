import { describe, expect, it } from "vitest";
import {
  FILE_MAX_BYTES,
  fileTooLargeMessage,
  isMissingError,
  isTooLarge,
  type TaskFormCheck,
  validateTaskForm,
} from "./validate";

const OK: TaskFormCheck = {
  projectId: 1,
  title: "Hoàn thiện trang Liên hệ",
  creatorId: 1,
  startDate: null,
  dueDate: null,
  subtasks: [],
};

describe("validateTaskForm (docs/02 §3)", () => {
  it("dữ liệu hợp lệ thì không lỗi", () => {
    expect(validateTaskForm(OK)).toEqual({});
  });

  it("thiếu tiêu đề (kể cả chỉ có khoảng trắng)", () => {
    expect(validateTaskForm({ ...OK, title: "" }).title).toBe("Vui lòng nhập tiêu đề.");
    expect(validateTaskForm({ ...OK, title: "   " }).title).toBe("Vui lòng nhập tiêu đề.");
    expect(isMissingError("Vui lòng nhập tiêu đề.")).toBe(true);
  });

  it("tiêu đề quá 500 ký tự (đếm sau khi bỏ khoảng trắng đầu/cuối)", () => {
    expect(validateTaskForm({ ...OK, title: "a".repeat(501) }).title).toBe(
      "Tiêu đề tối đa 500 ký tự.",
    );
    expect(validateTaskForm({ ...OK, title: ` ${"đ".repeat(500)} ` }).title).toBeUndefined();
    expect(isMissingError("Tiêu đề tối đa 500 ký tự.")).toBe(false);
  });

  it("ngày bắt đầu sau hạn chót (R-06)", () => {
    const late = { ...OK, startDate: "2026-09-16", dueDate: "2026-09-15" };
    expect(validateTaskForm(late).startDate).toBe("Ngày bắt đầu phải trước hoặc bằng hạn chót.");
    expect(
      validateTaskForm({ ...OK, startDate: "2026-09-15", dueDate: "2026-09-15" }).startDate,
    ).toBeUndefined();
    expect(validateTaskForm({ ...OK, startDate: "2026-09-16" }).startDate).toBeUndefined();
  });

  it("thiếu dự án, thiếu người tạo, việc con quá dài", () => {
    const e = validateTaskForm({
      ...OK,
      projectId: null,
      creatorId: null,
      subtasks: ["ok", "x".repeat(501)],
    });
    expect(e.projectId).toBe("Vui lòng chọn dự án.");
    expect(e.creatorId).toBe("Vui lòng chọn người tạo.");
    expect(e.subtasks).toBe("Việc con tối đa 500 ký tự.");
  });

  it("tệp quá 50 MB (R-09)", () => {
    expect(isTooLarge(FILE_MAX_BYTES)).toBe(false);
    expect(isTooLarge(FILE_MAX_BYTES + 1)).toBe(true);
    expect(fileTooLargeMessage("video.mp4")).toBe("Tệp “video.mp4” vượt quá 50 MB.");
  });
});
