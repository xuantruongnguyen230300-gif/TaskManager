//! Chữ hiển thị lưu sẵn trong `task_history` (docs/02 §7). Giá trị trống lưu NULL, UI hiện "(trống)".

use chrono::{Local, TimeZone};
use serde::{Deserialize, Serialize};

use super::dates::parse_iso;
use super::status::TaskStatus;

/// Loại thay đổi trong lịch sử — đúng 16 giá trị của CHECK trong `task_history.field`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum HistoryField {
    Created,
    Title,
    Description,
    Project,
    Status,
    Priority,
    Assignee,
    Creator,
    StartDate,
    DueDate,
    ActualStart,
    ActualEnd,
    AttachmentAdded,
    AttachmentRemoved,
    Deleted,
    Restored,
}

impl HistoryField {
    pub fn as_str(self) -> &'static str {
        match self {
            HistoryField::Created => "created",
            HistoryField::Title => "title",
            HistoryField::Description => "description",
            HistoryField::Project => "project",
            HistoryField::Status => "status",
            HistoryField::Priority => "priority",
            HistoryField::Assignee => "assignee",
            HistoryField::Creator => "creator",
            HistoryField::StartDate => "start_date",
            HistoryField::DueDate => "due_date",
            HistoryField::ActualStart => "actual_start",
            HistoryField::ActualEnd => "actual_end",
            HistoryField::AttachmentAdded => "attachment_added",
            HistoryField::AttachmentRemoved => "attachment_removed",
            HistoryField::Deleted => "deleted",
            HistoryField::Restored => "restored",
        }
    }
}

pub const EMPTY: &str = "(trống)";
pub const UNASSIGNED: &str = "Chưa giao";

/// 1 Thấp · 2 Trung bình · 3 Cao · 4 Khẩn cấp.
pub fn priority_label(p: i64) -> &'static str {
    match p {
        1 => "Thấp",
        2 => "Trung bình",
        3 => "Cao",
        4 => "Khẩn cấp",
        _ => "?",
    }
}

/// "Đang chờ (lý do: Chờ khách phản hồi)" hoặc "Đang chờ".
pub fn status_with_note(status: TaskStatus, note: Option<&str>) -> String {
    match note.map(str::trim).filter(|n| !n.is_empty()) {
        Some(n) if status.has_note() => format!("{} (lý do: {n})", status.label()),
        _ => status.label().to_string(),
    }
}

/// "YYYY-MM-DD" → "dd/MM/yyyy". Không đọc được thì trả nguyên chuỗi.
pub fn date_label(iso: &str) -> String {
    parse_iso(iso)
        .map(|d| d.format("%d/%m/%Y").to_string())
        .unwrap_or_else(|| iso.to_string())
}

/// ms UTC → "dd/MM/yyyy HH:mm" theo giờ máy.
pub fn datetime_label(ms: i64) -> String {
    datetime_label_in(&Local, ms)
}

pub fn datetime_label_in<Tz: TimeZone>(tz: &Tz, ms: i64) -> String
where
    Tz::Offset: std::fmt::Display,
{
    tz.timestamp_millis_opt(ms)
        .single()
        .map(|dt| dt.format("%d/%m/%Y %H:%M").to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;

    #[test]
    fn labels_match_spec() {
        assert_eq!(priority_label(2), "Trung bình");
        assert_eq!(priority_label(4), "Khẩn cấp");
        assert_eq!(
            status_with_note(TaskStatus::Waiting, Some("Chờ khách phản hồi")),
            "Đang chờ (lý do: Chờ khách phản hồi)"
        );
        assert_eq!(status_with_note(TaskStatus::Done, Some("x")), "Hoàn thành");
        assert_eq!(date_label("2026-09-15"), "15/09/2026");
    }

    #[test]
    fn datetime_label_uses_local_offset() {
        let vn = FixedOffset::east_opt(7 * 3600).unwrap();
        let ms = vn
            .with_ymd_and_hms(2026, 9, 12, 8, 20, 0)
            .unwrap()
            .timestamp_millis();
        assert_eq!(datetime_label_in(&vn, ms), "12/09/2026 08:20");
    }

    #[test]
    fn history_field_serializes_like_db() {
        assert_eq!(
            serde_json::to_string(&HistoryField::ActualEnd).unwrap(),
            "\"actual_end\""
        );
        assert_eq!(
            HistoryField::AttachmentRemoved.as_str(),
            "attachment_removed"
        );
    }
}
