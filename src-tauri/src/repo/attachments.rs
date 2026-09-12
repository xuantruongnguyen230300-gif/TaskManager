//! Bảng `task_attachments`. Chủ: B2.

use sqlx::SqliteConnection;

use crate::dto::{Attachment, Id};
use crate::error::AppResult;

/// Dòng tệp kèm `stored_path` (chỉ dùng trong Rust, không gửi ra UI).
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct StoredAttachment {
    pub id: Id,
    pub task_id: Id,
    pub file_name: String,
    pub stored_path: String,
}

pub async fn list_for_task(conn: &mut SqliteConnection, task_id: Id) -> AppResult<Vec<Attachment>> {
    Ok(sqlx::query_as::<_, Attachment>(
        "SELECT id, task_id, file_name, size_bytes, created_at FROM task_attachments
         WHERE task_id = ? ORDER BY created_at, id",
    )
    .bind(task_id)
    .fetch_all(conn)
    .await?)
}

pub async fn get_stored(
    conn: &mut SqliteConnection,
    id: Id,
) -> AppResult<Option<StoredAttachment>> {
    Ok(sqlx::query_as::<_, StoredAttachment>(
        "SELECT id, task_id, file_name, stored_path FROM task_attachments WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(conn)
    .await?)
}

pub async fn insert(
    conn: &mut SqliteConnection,
    task_id: Id,
    file_name: &str,
    stored_path: &str,
    size_bytes: i64,
    now: i64,
) -> AppResult<Attachment> {
    Ok(sqlx::query_as::<_, Attachment>(
        "INSERT INTO task_attachments (task_id, file_name, stored_path, size_bytes, created_at)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id, task_id, file_name, size_bytes, created_at",
    )
    .bind(task_id)
    .bind(file_name)
    .bind(stored_path)
    .bind(size_bytes)
    .bind(now)
    .fetch_one(conn)
    .await?)
}

pub async fn delete(conn: &mut SqliteConnection, id: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM task_attachments WHERE id = ?")
        .bind(id)
        .execute(conn)
        .await?;
    Ok(())
}

/// Mọi `stored_path` (cho sao lưu).
pub async fn all_stored_paths(conn: &mut SqliteConnection) -> AppResult<Vec<String>> {
    Ok(
        sqlx::query_scalar::<_, String>("SELECT stored_path FROM task_attachments ORDER BY id")
            .fetch_all(conn)
            .await?,
    )
}
