//! Hàm dùng chung cho test B1 (được `mod` từ các file b1_*.rs).
#![allow(dead_code)]

use quan_ly_task_lib::dto::Id;
use sqlx::SqlitePool;

pub struct T<'a> {
    pub code: &'a str,
    pub project_id: Id,
    pub status: &'a str,
    pub assignee: Option<Id>,
    pub creator: Id,
    pub due: Option<&'a str>,
    pub actual_end_at: Option<i64>,
    pub deleted_at: Option<i64>,
}

impl<'a> T<'a> {
    pub fn new(code: &'a str, project_id: Id, status: &'a str) -> Self {
        Self {
            code,
            project_id,
            status,
            assignee: None,
            creator: 1,
            due: None,
            actual_end_at: None,
            deleted_at: None,
        }
    }
}

/// Chèn thẳng một việc (không qua task_service của B2).
pub async fn insert_task(pool: &SqlitePool, t: T<'_>) -> Id {
    sqlx::query_scalar(
        "INSERT INTO tasks (code, project_id, title, status, priority, assignee_id, creator_id,
                            due_date, actual_end_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, 'Việc thử', ?, 2, ?, ?, ?, ?, 1, 1, ?) RETURNING id",
    )
    .bind(t.code)
    .bind(t.project_id)
    .bind(t.status)
    .bind(t.assignee)
    .bind(t.creator)
    .bind(t.due)
    .bind(t.actual_end_at)
    .bind(t.deleted_at)
    .fetch_one(pool)
    .await
    .unwrap()
}
