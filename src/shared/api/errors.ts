/** Lỗi từ Rust: `{ code, message, field? }` (src-tauri/src/error.rs). */

export type ErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "DUPLICATE_CODE"
  | "PROJECT_NOT_EMPTY"
  | "PROJECT_PROTECTED"
  | "EMPLOYEE_IN_USE"
  | "SELF_PROTECTED"
  | "FILE_TOO_LARGE"
  | "FILE_MISSING"
  | "RESTORE_INVALID"
  | "RESTORE_NEWER_SCHEMA"
  | "DB"
  | "IO"
  | "INTERNAL"
  | "NOT_IMPLEMENTED";

/** Câu dự phòng khi Rust không gửi message. Bình thường dùng luôn `error.message` từ Rust. */
const FALLBACK: Record<ErrorCode, string> = {
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  VALIDATION: "Dữ liệu chưa hợp lệ.",
  DUPLICATE_CODE: "Mã đã được dùng.",
  PROJECT_NOT_EMPTY: "Chỉ xoá được dự án không còn việc nào (kể cả trong Thùng rác).",
  PROJECT_PROTECTED: "Không thể xoá dự án Việc chung.",
  EMPLOYEE_IN_USE: "Nhân viên đã có việc hoặc bình luận nên không xoá được.",
  SELF_PROTECTED: "Không thể xoá hoặc chuyển Đã nghỉ hồ sơ “Tôi”.",
  FILE_TOO_LARGE: "Tệp vượt quá 50 MB.",
  FILE_MISSING: "Không tìm thấy tệp trong thư mục dữ liệu.",
  RESTORE_INVALID: "Tệp không phải bản sao lưu của Quản lý Task.",
  RESTORE_NEWER_SCHEMA: "Bản sao lưu được tạo bởi bản Quản lý Task mới hơn.",
  DB: "Lỗi cơ sở dữ liệu. Vui lòng thử lại.",
  IO: "Lỗi đọc/ghi tệp. Vui lòng thử lại.",
  INTERNAL: "Đã có lỗi xảy ra. Vui lòng thử lại.",
  NOT_IMPLEMENTED: "Chức năng này đang được xây dựng.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Tên trường camelCase (khớp input) khi code = VALIDATION. */
  readonly field: string | undefined;

  constructor(code: ErrorCode, message: string, field?: string) {
    super(message || FALLBACK[code]);
    this.name = "AppError";
    this.code = code;
    this.field = field;
  }
}

function isErrorCode(v: unknown): v is ErrorCode {
  return typeof v === "string" && v in FALLBACK;
}

/** Chuyển mọi lỗi (từ invoke, JS) thành AppError. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e && typeof e === "object" && "code" in e) {
    const o = e as { code: unknown; message?: unknown; field?: unknown };
    if (isErrorCode(o.code)) {
      return new AppError(
        o.code,
        typeof o.message === "string" ? o.message : "",
        typeof o.field === "string" ? o.field : undefined,
      );
    }
  }
  if (typeof e === "string") return new AppError("INTERNAL", e);
  return new AppError("INTERNAL", "");
}

/** Câu tiếng Việt để hiện toast. */
export function errorMessage(e: unknown): string {
  return toAppError(e).message;
}

export function isAppError(e: unknown, code?: ErrorCode): e is AppError {
  return e instanceof AppError && (code === undefined || e.code === code);
}
