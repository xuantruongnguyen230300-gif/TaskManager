//! Kiểm tra dữ liệu vào, thông điệp đúng docs/02 §3, §6. Trả `AppError::validation(field, msg)`;
//! `field` là tên camelCase của trường trong input DTO để UI hiện lỗi dưới đúng ô.

use crate::error::{AppError, AppResult, ErrorCode};

use super::dates::parse_iso;
use super::text::trim_opt;

pub const MAX_ATTACHMENT_BYTES: i64 = 50 * 1024 * 1024;

fn len(s: &str) -> usize {
    s.chars().count()
}

/// Bắt buộc, trim, tối đa `max` ký tự.
fn required(
    v: &str,
    field: &str,
    max: usize,
    empty_msg: &str,
    long_msg: &str,
) -> AppResult<String> {
    let t = v.trim();
    if t.is_empty() {
        return Err(AppError::validation(field, empty_msg));
    }
    if len(t) > max {
        return Err(AppError::validation(field, long_msg));
    }
    Ok(t.to_string())
}

/// Tuỳ chọn, trim (rỗng → None), tối đa `max` ký tự.
fn optional(v: Option<&str>, field: &str, max: usize, long_msg: &str) -> AppResult<Option<String>> {
    let t = trim_opt(v);
    if t.as_deref().is_some_and(|s| len(s) > max) {
        return Err(AppError::validation(field, long_msg));
    }
    Ok(t)
}

pub fn task_title(v: &str) -> AppResult<String> {
    required(
        v,
        "title",
        500,
        "Vui lòng nhập tiêu đề.",
        "Tiêu đề tối đa 500 ký tự.",
    )
}

pub fn priority(p: i64) -> AppResult<i64> {
    if (1..=4).contains(&p) {
        Ok(p)
    } else {
        Err(AppError::validation("priority", "Ưu tiên không hợp lệ."))
    }
}

/// Ngày tuỳ chọn "YYYY-MM-DD" (rỗng → None).
pub fn date_opt(v: Option<&str>, field: &str) -> AppResult<Option<String>> {
    match trim_opt(v) {
        None => Ok(None),
        Some(s) if parse_iso(&s).is_some() => Ok(Some(s)),
        Some(_) => Err(AppError::validation(field, "Ngày không hợp lệ.")),
    }
}

/// R-06: ngày bắt đầu ≤ hạn chót (chuỗi ISO so sánh được trực tiếp).
pub fn start_before_due(start: Option<&str>, due: Option<&str>) -> AppResult<()> {
    match (start, due) {
        (Some(s), Some(d)) if s > d => Err(AppError::validation(
            "startDate",
            "Ngày bắt đầu phải trước hoặc bằng hạn chót.",
        )),
        _ => Ok(()),
    }
}

/// R-06: kết thúc thực tế ≥ bắt đầu thực tế.
pub fn actual_range(start: Option<i64>, end: Option<i64>) -> AppResult<()> {
    match (start, end) {
        (Some(s), Some(e)) if e < s => Err(AppError::validation(
            "actualEndAt",
            "Kết thúc thực tế phải sau hoặc bằng bắt đầu thực tế.",
        )),
        _ => Ok(()),
    }
}

/// Dòng việc con: trim; rỗng → Ok(None) (form bỏ dòng trống); > 500 ký tự → lỗi.
pub fn subtask_title(v: &str) -> AppResult<Option<String>> {
    optional(Some(v), "subtasks", 500, "Việc con tối đa 500 ký tự.")
}

pub fn comment_body(v: &str) -> AppResult<String> {
    required(
        v,
        "body",
        5000,
        "Vui lòng nhập bình luận.",
        "Bình luận tối đa 5.000 ký tự.",
    )
}

pub fn project_name(v: &str) -> AppResult<String> {
    required(
        v,
        "name",
        100,
        "Vui lòng nhập tên dự án.",
        "Tên dự án tối đa 100 ký tự.",
    )
}

/// Mã dự án: trim, đổi sang in hoa; 2–6 ký tự A–Z/0–9, bắt đầu bằng chữ.
pub fn project_code(v: &str) -> AppResult<String> {
    let code = v.trim().to_ascii_uppercase();
    if code.is_empty() {
        return Err(AppError::validation("code", "Vui lòng nhập mã dự án."));
    }
    let ok = (2..=6).contains(&code.len())
        && code.starts_with(|c: char| c.is_ascii_uppercase())
        && code
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit());
    if !ok {
        return Err(AppError::validation(
            "code",
            "Mã dự án gồm 2–6 ký tự, bắt đầu bằng chữ cái, chỉ gồm A–Z và 0–9.",
        ));
    }
    Ok(code)
}

pub fn duplicate_project_code(code: &str) -> AppError {
    let mut e = AppError::validation("code", format!("Mã “{code}” đã được dùng cho dự án khác."));
    e.code = ErrorCode::DuplicateCode;
    e
}

pub fn employee_name(v: &str) -> AppResult<String> {
    required(
        v,
        "fullName",
        100,
        "Vui lòng nhập họ tên.",
        "Họ tên tối đa 100 ký tự.",
    )
}

pub fn employee_title(v: Option<&str>) -> AppResult<Option<String>> {
    optional(v, "title", 100, "Chức danh tối đa 100 ký tự.")
}

pub fn employee_phone(v: Option<&str>) -> AppResult<Option<String>> {
    optional(v, "phone", 20, "Điện thoại tối đa 20 ký tự.")
}

pub fn employee_email(v: Option<&str>) -> AppResult<Option<String>> {
    optional(v, "email", 254, "Email tối đa 254 ký tự.")
}

/// Màu `#RRGGBB`.
pub fn color_hex(v: &str) -> AppResult<String> {
    let c = v.trim();
    let ok = c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|ch| ch.is_ascii_hexdigit());
    if ok {
        Ok(c.to_ascii_uppercase())
    } else {
        Err(AppError::validation("color", "Màu không hợp lệ."))
    }
}

/// R-09: mỗi tệp ≤ 50 MB.
pub fn attachment_size(file_name: &str, size_bytes: i64) -> AppResult<()> {
    if size_bytes > MAX_ATTACHMENT_BYTES {
        let mut e = AppError::validation("files", format!("Tệp “{file_name}” vượt quá 50 MB."));
        e.code = ErrorCode::FileTooLarge;
        return Err(e);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_title_rules() {
        assert_eq!(task_title("  Làm báo cáo ").unwrap(), "Làm báo cáo");
        let e = task_title("   ").unwrap_err();
        assert_eq!(e.message, "Vui lòng nhập tiêu đề.");
        assert_eq!(e.field.as_deref(), Some("title"));
        assert!(task_title(&"a".repeat(500)).is_ok());
        assert_eq!(
            task_title(&"ă".repeat(501)).unwrap_err().message,
            "Tiêu đề tối đa 500 ký tự."
        );
    }

    #[test]
    fn r06_date_ranges() {
        assert!(start_before_due(Some("2026-09-10"), Some("2026-09-12")).is_ok());
        assert!(start_before_due(Some("2026-09-12"), Some("2026-09-12")).is_ok());
        let e = start_before_due(Some("2026-09-13"), Some("2026-09-12")).unwrap_err();
        assert_eq!(e.field.as_deref(), Some("startDate"));
        assert!(start_before_due(Some("2026-09-13"), None).is_ok());
        assert!(actual_range(Some(10), Some(10)).is_ok());
        assert!(actual_range(Some(10), Some(9)).is_err());
        assert!(date_opt(Some("2026-13-01"), "dueDate").is_err());
        assert_eq!(date_opt(Some(" "), "dueDate").unwrap(), None);
    }

    #[test]
    fn project_code_rules() {
        assert_eq!(project_code(" web ").unwrap(), "WEB");
        assert_eq!(project_code("A1").unwrap(), "A1");
        assert!(project_code("1AB").is_err());
        assert!(project_code("A").is_err());
        assert!(project_code("ABCDEFG").is_err());
        assert!(project_code("AB-C").is_err());
        assert_eq!(
            project_code("").unwrap_err().message,
            "Vui lòng nhập mã dự án."
        );
        assert_eq!(duplicate_project_code("WEB").code, ErrorCode::DuplicateCode);
    }

    #[test]
    fn employee_and_misc_rules() {
        assert_eq!(employee_name(" Lê Thu Hà ").unwrap(), "Lê Thu Hà");
        assert!(employee_phone(Some(&"0".repeat(21))).is_err());
        assert_eq!(employee_email(Some("  ")).unwrap(), None);
        assert_eq!(color_hex("#6e56cf").unwrap(), "#6E56CF");
        assert!(color_hex("6E56CF").is_err());
        assert_eq!(subtask_title("  ").unwrap(), None);
        assert!(comment_body(&"x".repeat(5001)).is_err());
        assert!(attachment_size("a.pdf", MAX_ATTACHMENT_BYTES).is_ok());
        let e = attachment_size("a.pdf", MAX_ATTACHMENT_BYTES + 1).unwrap_err();
        assert_eq!(e.code, ErrorCode::FileTooLarge);
        assert_eq!(e.message, "Tệp “a.pdf” vượt quá 50 MB.");
    }
}
