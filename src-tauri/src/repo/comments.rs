//! Bảng `task_comments`. Chủ: B2.

use sqlx::SqliteConnection;

use crate::dto::{Comment, Id};
use crate::error::AppResult;

macro_rules! comment_select {
    () => {
        "SELECT m.id, m.task_id, m.author_id, e.full_name AS author_name,
                e.color AS author_color, (e.status = 'inactive') AS author_inactive,
                m.body, m.created_at
         FROM task_comments m JOIN employees e ON e.id = m.author_id "
    };
}

/// Cũ nhất trước (mới nhất ở cuối).
pub async fn list_for_task(conn: &mut SqliteConnection, task_id: Id) -> AppResult<Vec<Comment>> {
    Ok(sqlx::query_as::<_, Comment>(concat!(
        comment_select!(),
        "WHERE m.task_id = ? ORDER BY m.created_at, m.id"
    ))
    .bind(task_id)
    .fetch_all(conn)
    .await?)
}

pub async fn get(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<Comment>> {
    Ok(
        sqlx::query_as::<_, Comment>(concat!(comment_select!(), "WHERE m.id = ?"))
            .bind(id)
            .fetch_optional(conn)
            .await?,
    )
}

pub async fn insert(
    conn: &mut SqliteConnection,
    task_id: Id,
    author_id: Id,
    body: &str,
    now: i64,
) -> AppResult<Id> {
    Ok(sqlx::query_scalar::<_, i64>(
        "INSERT INTO task_comments (task_id, author_id, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(task_id)
    .bind(author_id)
    .bind(body)
    .bind(now)
    .bind(now)
    .fetch_one(conn)
    .await?)
}

/// Việc chứa bình luận (`None` = không có bình luận).
pub async fn task_of(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<Id>> {
    Ok(
        sqlx::query_scalar::<_, i64>("SELECT task_id FROM task_comments WHERE id = ?")
            .bind(id)
            .fetch_optional(conn)
            .await?,
    )
}

pub async fn delete(conn: &mut SqliteConnection, id: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM task_comments WHERE id = ?")
        .bind(id)
        .execute(conn)
        .await?;
    Ok(())
}
