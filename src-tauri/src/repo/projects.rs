//! Bảng `projects`. Chủ: B1.

use sqlx::SqliteConnection;

use crate::dto::{Id, ProjectSummary};
use crate::error::AppResult;

/// Tiến độ bỏ việc trong Thùng rác (02 §8); `has_tasks` tính cả Thùng rác (R-02, khoá mã).
macro_rules! summary_select {
    () => {
        "SELECT p.id, p.code, p.name, p.color, p.next_task_no,
            COALESCE(SUM(t.id IS NOT NULL AND t.deleted_at IS NULL AND t.status = 'done'), 0) AS done_count,
            COALESCE(SUM(t.id IS NOT NULL AND t.deleted_at IS NULL AND t.status <> 'cancelled'), 0) AS progress_total,
            COUNT(t.id) > 0 AS has_tasks,
            p.id = 1 AS is_default
         FROM projects p LEFT JOIN tasks t ON t.project_id = p.id"
    };
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ProjectBase {
    pub id: Id,
    pub code: String,
    pub name: String,
}

pub async fn list_summaries(conn: &mut SqliteConnection) -> AppResult<Vec<ProjectSummary>> {
    Ok(sqlx::query_as::<_, ProjectSummary>(concat!(
        summary_select!(),
        " GROUP BY p.id ORDER BY p.id"
    ))
    .fetch_all(conn)
    .await?)
}

pub async fn get_summary(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<ProjectSummary>> {
    Ok(sqlx::query_as::<_, ProjectSummary>(concat!(
        summary_select!(),
        " WHERE p.id = ? GROUP BY p.id"
    ))
    .bind(id)
    .fetch_optional(conn)
    .await?)
}

pub async fn find(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<ProjectBase>> {
    Ok(
        sqlx::query_as::<_, ProjectBase>("SELECT id, code, name FROM projects WHERE id = ?")
            .bind(id)
            .fetch_optional(conn)
            .await?,
    )
}

/// Mã đã dùng cho dự án khác (`exclude_id` = dự án đang sửa).
pub async fn code_taken(
    conn: &mut SqliteConnection,
    code: &str,
    exclude_id: Option<Id>,
) -> AppResult<bool> {
    Ok(sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM projects WHERE code = ? AND (? IS NULL OR id <> ?))",
    )
    .bind(code)
    .bind(exclude_id)
    .bind(exclude_id)
    .fetch_one(conn)
    .await?)
}

/// Có ít nhất một việc, kể cả trong Thùng rác.
pub async fn has_tasks(conn: &mut SqliteConnection, id: Id) -> AppResult<bool> {
    Ok(
        sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM tasks WHERE project_id = ?)")
            .bind(id)
            .fetch_one(conn)
            .await?,
    )
}

/// docs/03 Q3: số kế tiếp cho mã `code` để không sinh trùng mã việc cũ (việc đã chuyển dự án).
pub async fn next_no_for_code(conn: &mut SqliteConnection, code: &str) -> AppResult<i64> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(MAX(CAST(substr(code, length(?) + 2) AS INTEGER)), 0) + 1
         FROM tasks WHERE code GLOB ? || '-[0-9]*'",
    )
    .bind(code)
    .bind(code)
    .fetch_one(conn)
    .await?)
}

pub async fn insert(
    conn: &mut SqliteConnection,
    code: &str,
    name: &str,
    color: &str,
    next_task_no: i64,
    now: i64,
) -> AppResult<Id> {
    Ok(sqlx::query_scalar::<_, Id>(
        "INSERT INTO projects (code, name, color, next_task_no, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(code)
    .bind(name)
    .bind(color)
    .bind(next_task_no)
    .bind(now)
    .bind(now)
    .fetch_one(conn)
    .await?)
}

pub async fn update(
    conn: &mut SqliteConnection,
    id: Id,
    code: &str,
    name: &str,
    color: &str,
    next_task_no: Option<i64>,
    now: i64,
) -> AppResult<()> {
    sqlx::query(
        "UPDATE projects SET code = ?, name = ?, color = ?,
                next_task_no = COALESCE(?, next_task_no), updated_at = ?
         WHERE id = ?",
    )
    .bind(code)
    .bind(name)
    .bind(color)
    .bind(next_task_no)
    .bind(now)
    .bind(id)
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut SqliteConnection, id: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(conn)
        .await?;
    Ok(())
}
