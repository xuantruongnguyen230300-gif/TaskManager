//! 5 trạng thái việc và quy tắc tự điền khi chuyển (docs/02 §5, docs/03 §2).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum TaskStatus {
    New,
    InProgress,
    Waiting,
    Done,
    Cancelled,
}

impl TaskStatus {
    pub const ALL: [TaskStatus; 5] = [
        TaskStatus::New,
        TaskStatus::InProgress,
        TaskStatus::Waiting,
        TaskStatus::Done,
        TaskStatus::Cancelled,
    ];
    /// "Đang mở" = Mới + Đang làm + Đang chờ.
    pub const OPEN: [TaskStatus; 3] =
        [TaskStatus::New, TaskStatus::InProgress, TaskStatus::Waiting];

    pub fn as_str(self) -> &'static str {
        match self {
            TaskStatus::New => "new",
            TaskStatus::InProgress => "in_progress",
            TaskStatus::Waiting => "waiting",
            TaskStatus::Done => "done",
            TaskStatus::Cancelled => "cancelled",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|st| st.as_str() == s)
    }

    /// Nhãn tiếng Việt (dùng cho lịch sử).
    pub fn label(self) -> &'static str {
        match self {
            TaskStatus::New => "Mới",
            TaskStatus::InProgress => "Đang làm",
            TaskStatus::Waiting => "Đang chờ",
            TaskStatus::Done => "Hoàn thành",
            TaskStatus::Cancelled => "Đã huỷ",
        }
    }

    pub fn is_open(self) -> bool {
        Self::OPEN.contains(&self)
    }

    /// Trạng thái có ô lý do (`status_note`): Đang chờ, Đã huỷ.
    pub fn has_note(self) -> bool {
        matches!(self, TaskStatus::Waiting | TaskStatus::Cancelled)
    }
}

/// Các trường của việc bị ảnh hưởng khi đổi trạng thái.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusFields {
    pub status: TaskStatus,
    pub status_note: Option<String>,
    pub actual_start_at: Option<i64>,
    pub actual_end_at: Option<i64>,
}

impl StatusFields {
    /// Trạng thái gốc khi tạo việc (trước khi áp trạng thái người dùng chọn).
    pub fn initial() -> Self {
        Self {
            status: TaskStatus::New,
            status_note: None,
            actual_start_at: None,
            actual_end_at: None,
        }
    }
}

/// Áp quy tắc chuyển trạng thái (chuyển tự do, không có bảng cấm):
/// - vào Đang làm mà Bắt đầu thực tế trống → điền `now`;
/// - vào Hoàn thành → Kết thúc thực tế = `now`; rời Hoàn thành → xoá Kết thúc thực tế;
/// - trạng thái Đang chờ/Đã huỷ giữ lý do `note` (trim, rỗng = None); trạng thái khác xoá lý do.
///
/// Giữ nguyên trạng thái thì chỉ cập nhật lý do. Dùng chung cho form, dropdown chi tiết và Kanban.
pub fn apply_status_change(
    current: &StatusFields,
    new_status: TaskStatus,
    note: Option<&str>,
    now: i64,
) -> StatusFields {
    let note = if new_status.has_note() {
        note.map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
    } else {
        None
    };
    let mut next = StatusFields {
        status: new_status,
        status_note: note,
        ..current.clone()
    };
    if new_status == current.status {
        return next;
    }
    if new_status == TaskStatus::InProgress && next.actual_start_at.is_none() {
        next.actual_start_at = Some(now);
    }
    if new_status == TaskStatus::Done {
        next.actual_end_at = Some(now);
    } else if current.status == TaskStatus::Done {
        next.actual_end_at = None;
    }
    next
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_789_206_600_000;

    fn fields(status: TaskStatus) -> StatusFields {
        StatusFields {
            status,
            ..StatusFields::initial()
        }
    }

    #[test]
    fn serde_uses_snake_case() {
        assert_eq!(
            serde_json::to_string(&TaskStatus::InProgress).unwrap(),
            "\"in_progress\""
        );
        assert_eq!(TaskStatus::parse("cancelled"), Some(TaskStatus::Cancelled));
        assert_eq!(TaskStatus::parse("x"), None);
    }

    #[test]
    fn into_in_progress_fills_start_once() {
        let next = apply_status_change(&fields(TaskStatus::New), TaskStatus::InProgress, None, NOW);
        assert_eq!(next.actual_start_at, Some(NOW));
        let started = StatusFields {
            actual_start_at: Some(5),
            ..fields(TaskStatus::Waiting)
        };
        let next = apply_status_change(&started, TaskStatus::InProgress, None, NOW);
        assert_eq!(next.actual_start_at, Some(5));
    }

    #[test]
    fn into_done_sets_end_and_leaving_done_clears_it() {
        let done =
            apply_status_change(&fields(TaskStatus::InProgress), TaskStatus::Done, None, NOW);
        assert_eq!(done.actual_end_at, Some(NOW));
        let reopened = apply_status_change(&done, TaskStatus::InProgress, None, NOW + 1);
        assert_eq!(reopened.actual_end_at, None);
    }

    #[test]
    fn note_kept_only_for_waiting_and_cancelled() {
        let w = apply_status_change(
            &fields(TaskStatus::New),
            TaskStatus::Waiting,
            Some("  Chờ khách "),
            NOW,
        );
        assert_eq!(w.status_note.as_deref(), Some("Chờ khách"));
        let back = apply_status_change(&w, TaskStatus::InProgress, Some("bỏ qua"), NOW);
        assert_eq!(back.status_note, None);
        let empty = apply_status_change(
            &fields(TaskStatus::New),
            TaskStatus::Cancelled,
            Some("  "),
            NOW,
        );
        assert_eq!(empty.status_note, None);
    }

    #[test]
    fn create_directly_as_done_sets_end_only() {
        let created = apply_status_change(&StatusFields::initial(), TaskStatus::Done, None, NOW);
        assert_eq!(created.actual_end_at, Some(NOW));
        assert_eq!(created.actual_start_at, None);
    }
}
