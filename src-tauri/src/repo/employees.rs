//! Bảng `employees`. Chủ: B1.

use sqlx::SqliteConnection;

use crate::dto::{EmployeeDetail, EmployeeRow, Id};
use crate::error::AppResult;

/// Thông tin tối thiểu để service kiểm tra quy tắc.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct EmployeeBase {
    pub id: Id,
    pub full_name: String,
    pub is_self: bool,
    pub status: String,
}

impl EmployeeBase {
    pub fn is_active(&self) -> bool {
        self.status == "active"
    }
}

/// Dữ liệu ghi (đã kiểm tra, đã trim).
#[derive(Debug, Clone)]
pub struct EmployeeData {
    pub full_name: String,
    pub title: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub color: String,
}

/// `status` = None → mọi trạng thái. Chưa sắp (service sắp theo tên không dấu).
pub async fn list(
    conn: &mut SqliteConnection,
    status: Option<&str>,
    today: &str,
) -> AppResult<Vec<EmployeeRow>> {
    Ok(sqlx::query_as::<_, EmployeeRow>(
        "SELECT e.id, e.full_name, e.title, e.phone, e.email, e.color, e.is_self, e.status,
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = e.id AND t.deleted_at IS NULL
                   AND t.status IN ('new', 'in_progress', 'waiting')) AS open_count,
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = e.id AND t.deleted_at IS NULL
                   AND t.status IN ('new', 'in_progress', 'waiting') AND t.due_date < ?) AS overdue_count
         FROM employees e
         WHERE (? IS NULL OR e.status = ?)",
    )
    .bind(today)
    .bind(status)
    .bind(status)
    .fetch_all(conn)
    .await?)
}

/// Chi tiết + 3 số. `done_since` = bây giờ − 30 ngày (ms).
pub async fn get_detail(
    conn: &mut SqliteConnection,
    id: Id,
    today: &str,
    done_since: i64,
) -> AppResult<Option<EmployeeDetail>> {
    Ok(sqlx::query_as::<_, EmployeeDetail>(
        "SELECT e.id, e.full_name, e.title, e.phone, e.email, e.color, e.is_self, e.status,
                e.created_at, e.updated_at,
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = e.id AND t.deleted_at IS NULL
                   AND t.status IN ('new', 'in_progress', 'waiting')) AS open_count,
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = e.id AND t.deleted_at IS NULL
                   AND t.status IN ('new', 'in_progress', 'waiting') AND t.due_date < ?) AS overdue_count,
                (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = e.id AND t.deleted_at IS NULL
                   AND t.status = 'done' AND t.actual_end_at >= ?) AS done_30d_count
         FROM employees e WHERE e.id = ?",
    )
    .bind(today)
    .bind(done_since)
    .bind(id)
    .fetch_optional(conn)
    .await?)
}

pub async fn find(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<EmployeeBase>> {
    Ok(sqlx::query_as::<_, EmployeeBase>(
        "SELECT id, full_name, is_self, status FROM employees WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(conn)
    .await?)
}

pub async fn self_id(conn: &mut SqliteConnection) -> AppResult<Id> {
    Ok(
        sqlx::query_scalar::<_, Id>("SELECT id FROM employees WHERE is_self = 1")
            .fetch_one(conn)
            .await?,
    )
}

pub async fn insert(
    conn: &mut SqliteConnection,
    data: &EmployeeData,
    status: &str,
    now: i64,
) -> AppResult<Id> {
    Ok(sqlx::query_scalar::<_, Id>(
        "INSERT INTO employees (full_name, title, phone, email, color, is_self, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?) RETURNING id",
    )
    .bind(&data.full_name)
    .bind(&data.title)
    .bind(&data.phone)
    .bind(&data.email)
    .bind(&data.color)
    .bind(status)
    .bind(now)
    .bind(now)
    .fetch_one(conn)
    .await?)
}

pub async fn update(
    conn: &mut SqliteConnection,
    id: Id,
    data: &EmployeeData,
    now: i64,
) -> AppResult<()> {
    sqlx::query(
        "UPDATE employees SET full_name = ?, title = ?, phone = ?, email = ?, color = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&data.full_name)
    .bind(&data.title)
    .bind(&data.phone)
    .bind(&data.email)
    .bind(&data.color)
    .bind(now)
    .bind(id)
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn set_status(
    conn: &mut SqliteConnection,
    id: Id,
    status: &str,
    now: i64,
) -> AppResult<()> {
    sqlx::query("UPDATE employees SET status = ?, updated_at = ? WHERE id = ?")
        .bind(status)
        .bind(now)
        .bind(id)
        .execute(conn)
        .await?;
    Ok(())
}

/// Đã là người phụ trách/người tạo của việc nào (kể cả Thùng rác) hoặc có bình luận (R-05).
pub async fn is_in_use(conn: &mut SqliteConnection, id: Id) -> AppResult<bool> {
    Ok(sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM tasks WHERE assignee_id = ? OR creator_id = ?)
             OR EXISTS (SELECT 1 FROM task_comments WHERE author_id = ?)",
    )
    .bind(id)
    .bind(id)
    .bind(id)
    .fetch_one(conn)
    .await?)
}

pub async fn delete(conn: &mut SqliteConnection, id: Id) -> AppResult<()> {
    sqlx::query("DELETE FROM employees WHERE id = ?")
        .bind(id)
        .execute(conn)
        .await?;
    Ok(())
}

/// Việc chưa xong (Mới/Đang làm/Đang chờ, chưa xoá) mà người này phụ trách — R-04.
pub async fn open_task_ids(conn: &mut SqliteConnection, assignee_id: Id) -> AppResult<Vec<Id>> {
    Ok(sqlx::query_scalar::<_, Id>(
        "SELECT id FROM tasks WHERE assignee_id = ? AND deleted_at IS NULL
           AND status IN ('new', 'in_progress', 'waiting') ORDER BY id",
    )
    .bind(assignee_id)
    .fetch_all(conn)
    .await?)
}

/// Đổi người phụ trách của một việc (R-04), cập nhật `updated_at`.
pub async fn reassign_task(
    conn: &mut SqliteConnection,
    task_id: Id,
    assignee_id: Option<Id>,
    now: i64,
) -> AppResult<()> {
    sqlx::query("UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE id = ?")
        .bind(assignee_id)
        .bind(now)
        .bind(task_id)
        .execute(conn)
        .await?;
    Ok(())
}
