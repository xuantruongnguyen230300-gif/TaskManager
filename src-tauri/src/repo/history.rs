//! Bảng `task_history`. Chủ: B2.

use sqlx::SqliteConnection;

use crate::dto::{HistoryEntry, HistoryField, Id};
use crate::error::AppResult;

pub async fn insert(
    conn: &mut SqliteConnection,
    task_id: Id,
    changed_at: i64,
    field: HistoryField,
    old_value: Option<&str>,
    new_value: Option<&str>,
) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO task_history (task_id, changed_at, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(task_id)
    .bind(changed_at)
    .bind(field.as_str())
    .bind(old_value)
    .bind(new_value)
    .execute(conn)
    .await?;
    Ok(())
}

/// Mới nhất trước (docs/03 Q4).
pub async fn list_for_task(
    conn: &mut SqliteConnection,
    task_id: Id,
) -> AppResult<Vec<HistoryEntry>> {
    Ok(sqlx::query_as::<_, HistoryEntry>(
        "SELECT id, changed_at, field, old_value, new_value FROM task_history
         WHERE task_id = ? ORDER BY changed_at DESC, id DESC",
    )
    .bind(task_id)
    .fetch_all(conn)
    .await?)
}
