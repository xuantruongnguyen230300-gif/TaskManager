//! Ghi lịch sử việc (docs/02 §7, docs/05 §5). Gọi TRONG transaction của task_service.
//! Giá trị là chữ hiển thị sẵn (domain::labels); trống = None (UI hiện "(trống)").

use sqlx::SqliteConnection;

use crate::dto::{HistoryField, Id};
use crate::error::AppResult;
use crate::repo;

/// Một thay đổi cần ghi.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Change {
    pub field: HistoryField,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
}

impl Change {
    pub fn new(field: HistoryField, old_value: Option<String>, new_value: Option<String>) -> Self {
        Self {
            field,
            old_value,
            new_value,
        }
    }
}

/// Ghi mỗi thay đổi thành một dòng `task_history` với cùng thời điểm `now`.
pub async fn record(
    conn: &mut SqliteConnection,
    task_id: Id,
    now: i64,
    changes: &[Change],
) -> AppResult<()> {
    for c in changes {
        repo::history::insert(
            conn,
            task_id,
            now,
            c.field,
            c.old_value.as_deref(),
            c.new_value.as_deref(),
        )
        .await?;
    }
    Ok(())
}
