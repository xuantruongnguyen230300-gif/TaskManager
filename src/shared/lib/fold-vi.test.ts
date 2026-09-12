import { describe, expect, it } from "vitest";
import { foldVi, includesFolded } from "./fold-vi";

describe("foldVi (R-11)", () => {
  it("bỏ dấu, đ→d, chữ thường", () => {
    expect(foldVi("Hoá đơn")).toBe("hoa don");
    expect(foldVi("ĐĂNG NHẬP")).toBe("dang nhap");
  });

  it("tìm không dấu", () => {
    expect(includesFolded("Đăng nhập bằng Google", "dang nhap")).toBe(true);
    expect(includesFolded("WEB-12", "web-1")).toBe(true);
    expect(includesFolded("Báo giá", "hoa don")).toBe(false);
  });
});
