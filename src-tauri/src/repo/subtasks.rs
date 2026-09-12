//! Bảng `subtasks`. Chủ: B2.

use sqlx::SqliteConnection;

use crate::dto::{Id, Subtask};
use crate::error::AppResult;

pub async fn list_for_task(conn: &mut SqliteConnection, task_id: Id) -> AppResult<Vec<Subtask>> {
    Ok(sqlx::query_as::<_, Subtask>(
        "SELECT id, task_id, title, is_done, position FROM subtasks
         WHERE task_id = ? ORDER BY position, id",
    )
    .bind(task_id)
    .fetch_all(conn)
    .await?)
}

pub async fn get(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<Subtask>> {
    Ok(sqlx::query_as::<_, Subtask>(
        "SELECT id, task_id, title, is_done, position FROM subtasks WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(conn)
    .await?)
}

/// Vị trí cuối danh sách (max + 1).
pub async fn next_position(conn: &mut SqliteConnection, task_id: Id) -> AppResult<i64> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM subtasks WHERE task_id = ?",
    )
    .bind(task_id)
    .fetch_one(conn)
    .await?)
}

pub async fn insert(
    conn: &mut SqliteConnection,
    task_id: Id,
    title: &str,
    position: i64,
) -> AppResult<Id> {
    Ok(sqlx::query_scalar::<_, i64>(
        "INSERT INTO subtasks (task_id, title, is_done, position) VALUES (?, ?, 0, ?) RETURNING id",
    )
    .bind(task_id)
    .bind(title)
    .bind(position)
    .fetch_one(conn)
    .await?)
}

pub async fn update(
    conn: &mut SqliteConnection,
    id: Id,
    title: &str,
    is_done: bool,
    position: i64,
) -> AppResult<()> {
    sqlx::query("UPDATE subtasks SET title = ?, is_done = ?, position = ? WHERE id = ?")
        .bind(title)
        .bind(is_done)
        .bind(position)
        .bind(id)
        .execute(conn)
        .await?;
    Ok(())
}

pub async fn delete(conn: &mut SqliteConnection, id: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM subtasks WHERE id = ?")
        .bind(id)
        .execute(conn)
        .await?;
    Ok(())
}
