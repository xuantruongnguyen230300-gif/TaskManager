//! Lỗi thống nhất của app. Mọi command trả `Result<T, AppError>`.
//! JSON gửi sang UI: `{ "code": "VALIDATION", "message": "Vui lòng nhập tiêu đề.", "field": "title" }`.

use serde::Serialize;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    NotFound,
    Validation,
    DuplicateCode,
    ProjectNotEmpty,
    ProjectProtected,
    EmployeeInUse,
    SelfProtected,
    FileTooLarge,
    FileMissing,
    RestoreInvalid,
    RestoreNewerSchema,
    Db,
    Io,
    Internal,
    NotImplemented,
}

#[derive(Debug, Clone, Serialize, thiserror::Error)]
#[serde(rename_all = "camelCase")]
#[error("{code:?}: {message}")]
pub struct AppError {
    pub code: ErrorCode,
    /// Câu tiếng Việt hiển thị thẳng cho người dùng.
    pub message: String,
    /// Tên trường (camelCase, khớp input DTO) để UI hiện lỗi dưới đúng ô. Chỉ dùng với `Validation`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            field: None,
        }
    }

    /// Lỗi kiểm tra dữ liệu gắn với một trường của form.
    pub fn validation(field: &str, message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::Validation,
            message: message.into(),
            field: Some(field.to_string()),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotFound, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Internal, message)
    }

    /// Dùng cho thân command/service chưa hiện thực (khung M0).
    pub fn not_implemented() -> Self {
        Self::new(
            ErrorCode::NotImplemented,
            "Chức năng này đang được xây dựng.",
        )
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match &err {
            sqlx::Error::RowNotFound => AppError::not_found("Không tìm thấy dữ liệu."),
            sqlx::Error::Database(db) => {
                let msg = db.message();
                if msg.contains("PROJECT_DEFAULT_LOCKED") {
                    AppError::new(
                        ErrorCode::ProjectProtected,
                        "Không thể xoá dự án Việc chung.",
                    )
                } else if msg.contains("SELF_LOCKED") {
                    AppError::new(
                        ErrorCode::SelfProtected,
                        "Không thể xoá hoặc chuyển Đã nghỉ hồ sơ “Tôi”.",
                    )
                } else if msg.contains("TASK_CODE_LOCKED") {
                    AppError::internal("Mã việc không được thay đổi.")
                } else if db.is_foreign_key_violation() {
                    // Service nên tự kiểm tra trước và trả mã cụ thể (PROJECT_NOT_EMPTY, EMPLOYEE_IN_USE).
                    tracing::warn!(code = ?db.code(), "vi phạm khoá ngoại");
                    AppError::new(
                        ErrorCode::Db,
                        "Dữ liệu đang được dùng ở nơi khác nên không thể thay đổi.",
                    )
                } else {
                    tracing::error!(code = ?db.code(), "lỗi cơ sở dữ liệu");
                    AppError::new(ErrorCode::Db, "Lỗi cơ sở dữ liệu. Vui lòng thử lại.")
                }
            }
            _ => {
                tracing::error!(error = %err, "lỗi sqlx");
                AppError::new(ErrorCode::Db, "Lỗi cơ sở dữ liệu. Vui lòng thử lại.")
            }
        }
    }
}

impl From<sqlx::migrate::MigrateError> for AppError {
    fn from(err: sqlx::migrate::MigrateError) -> Self {
        tracing::error!(error = %err, "lỗi migration");
        match err {
            sqlx::migrate::MigrateError::VersionMissing(_) => AppError::new(
                ErrorCode::RestoreNewerSchema,
                "Dữ liệu được tạo bởi bản Quản lý Task mới hơn. Vui lòng cài bản mới hơn.",
            ),
            _ => AppError::new(ErrorCode::Db, "Không nâng cấp được cơ sở dữ liệu."),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        tracing::error!(kind = ?err.kind(), "lỗi IO");
        AppError::new(ErrorCode::Io, "Lỗi đọc/ghi tệp. Vui lòng thử lại.")
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(err: zip::result::ZipError) -> Self {
        tracing::error!(error = %err, "lỗi zip");
        AppError::new(ErrorCode::Io, "Lỗi đọc/ghi tệp sao lưu.")
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        tracing::error!(error = %err, "lỗi JSON");
        AppError::internal("Lỗi xử lý dữ liệu.")
    }
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        tracing::error!(error = %err, "lỗi tauri");
        AppError::internal("Lỗi hệ thống.")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_to_code_message_field() {
        let e = AppError::validation("title", "Vui lòng nhập tiêu đề.");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["code"], "VALIDATION");
        assert_eq!(json["message"], "Vui lòng nhập tiêu đề.");
        assert_eq!(json["field"], "title");
        let e = AppError::not_implemented();
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["code"], "NOT_IMPLEMENTED");
        assert!(json.get("field").is_none());
    }
}
