//! Bảng `tasks` (+ đọc kèm projects/employees cho TaskRow/TaskInfo, Tổng quan, Thùng rác). Chủ: B2.

use sqlx::SqliteConnection;

use crate::domain::dates::{DAY_MS, TRASH_RETENTION_DAYS};
use crate::domain::status::{StatusFields, TaskStatus};
use crate::dto::{EmployeeStatus, EmployeeWorkload, Id, TaskInfo, TaskRow, TrashRow};
use crate::error::AppResult;

/// SELECT chung của `TaskRow` (docs/03 Q2) kèm số việc con x/y, số bình luận, số tệp.
macro_rules! task_row_select {
    () => {
        "SELECT t.id, t.code, t.title, t.project_id, p.code AS project_code,
                p.name AS project_name, p.color AS project_color, t.assignee_id,
                a.full_name AS assignee_name, a.color AS assignee_color,
                COALESCE(a.status = 'inactive', 0) AS assignee_inactive,
                t.creator_id, c.full_name AS creator_name, t.status, t.priority,
                t.start_date, t.due_date, t.actual_end_at, t.created_at,
                (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_done = 1) AS subtask_done,
                (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS subtask_total,
                (SELECT COUNT(*) FROM task_comments m WHERE m.task_id = t.id) AS comment_count,
                (SELECT COUNT(*) FROM task_attachments f WHERE f.task_id = t.id) AS attachment_count
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         LEFT JOIN employees a ON a.id = t.assignee_id
         JOIN employees c ON c.id = t.creator_id "
    };
}

/// Tham số của Q2 (đã chuẩn hoá từ `TaskFilter`).
pub struct TaskQuery<'a> {
    pub project_id: Option<Id>,
    pub assignee_id: Option<Id>,
    /// Lọc "Chưa giao".
    pub unassigned: bool,
    /// Mảng JSON các trạng thái, ví dụ `["new","in_progress","waiting"]`.
    pub statuses_json: String,
    /// `overdue` | `thisWeek` | `noDue`.
    pub due: Option<&'a str>,
    pub today: &'a str,
    pub monday: &'a str,
    pub sunday: &'a str,
}

/// docs/03 Q2 — chỉ việc chưa xoá, sắp `created_at DESC`.
pub async fn list_rows(conn: &mut SqliteConnection, q: &TaskQuery<'_>) -> AppResult<Vec<TaskRow>> {
    Ok(sqlx::query_as::<_, TaskRow>(concat!(
        task_row_select!(),
        "WHERE t.deleted_at IS NULL
           AND (?1 IS NULL OR t.project_id = ?1)
           AND (?2 = 0 OR t.assignee_id IS NULL)
           AND (?3 IS NULL OR t.assignee_id = ?3)
           AND t.status IN (SELECT value FROM json_each(?4))
           AND (?5 IS NULL
                OR (?5 = 'overdue' AND t.status IN ('new', 'in_progress', 'waiting') AND t.due_date < ?6)
                OR (?5 = 'thisWeek' AND t.due_date BETWEEN ?7 AND ?8)
                OR (?5 = 'noDue' AND t.due_date IS NULL))
         ORDER BY t.created_at DESC, t.id DESC"
    ))
    .bind(q.project_id)
    .bind(q.unassigned)
    .bind(q.assignee_id)
    .bind(q.statuses_json.as_str())
    .bind(q.due)
    .bind(q.today)
    .bind(q.monday)
    .bind(q.sunday)
    .fetch_all(conn)
    .await?)
}

/// "Cần chú ý" (docs/03 Q1): đang mở, hạn chót ≤ ngày mai, sắp theo hạn tăng dần.
pub async fn attention_rows(
    conn: &mut SqliteConnection,
    tomorrow: &str,
) -> AppResult<Vec<TaskRow>> {
    Ok(sqlx::query_as::<_, TaskRow>(concat!(
        task_row_select!(),
        "WHERE t.deleted_at IS NULL AND t.status IN ('new', 'in_progress', 'waiting')
           AND t.due_date <= ?
         ORDER BY t.due_date, t.priority DESC, t.id"
    ))
    .bind(tomorrow)
    .fetch_all(conn)
    .await?)
}

pub async fn get_info(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<TaskInfo>> {
    Ok(sqlx::query_as::<_, TaskInfo>(
        "SELECT t.id, t.code, t.project_id, p.code AS project_code, p.name AS project_name,
                p.color AS project_color, t.title, t.description, t.status, t.status_note,
                t.priority, t.assignee_id, a.full_name AS assignee_name, a.color AS assignee_color,
                COALESCE(a.status = 'inactive', 0) AS assignee_inactive,
                t.creator_id, c.full_name AS creator_name, c.color AS creator_color,
                (c.status = 'inactive') AS creator_inactive,
                t.start_date, t.due_date, t.actual_start_at, t.actual_end_at,
                t.created_at, t.updated_at, t.deleted_at
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         LEFT JOIN employees a ON a.id = t.assignee_id
         JOIN employees c ON c.id = t.creator_id
         WHERE t.id = ?",
    )
    .bind(id)
    .fetch_optional(conn)
    .await?)
}

/// Các cột gốc của một việc (để so sánh cũ/mới khi sửa).
#[derive(Debug, Clone, PartialEq, Eq, sqlx::FromRow)]
pub struct TaskRecord {
    pub id: Id,
    pub code: String,
    pub project_id: Id,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub status_note: Option<String>,
    pub priority: i64,
    pub assignee_id: Option<Id>,
    pub creator_id: Id,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub actual_start_at: Option<i64>,
    pub actual_end_at: Option<i64>,
    pub deleted_at: Option<i64>,
}

impl TaskRecord {
    pub fn status_fields(&self) -> StatusFields {
        StatusFields {
            status: self.status,
            status_note: self.status_note.clone(),
            actual_start_at: self.actual_start_at,
            actual_end_at: self.actual_end_at,
        }
    }

    pub fn set_status_fields(&mut self, f: StatusFields) {
        self.status = f.status;
        self.status_note = f.status_note;
        self.actual_start_at = f.actual_start_at;
        self.actual_end_at = f.actual_end_at;
    }
}

pub async fn get_record(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<TaskRecord>> {
    Ok(sqlx::query_as::<_, TaskRecord>(
        "SELECT id, code, project_id, title, description, status, status_note, priority,
                assignee_id, creator_id, start_date, due_date, actual_start_at, actual_end_at,
                deleted_at
         FROM tasks WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(conn)
    .await?)
}

/// Việc tồn tại và chưa vào Thùng rác.
pub async fn exists_active(conn: &mut SqliteConnection, id: Id) -> AppResult<bool> {
    Ok(sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM tasks WHERE id = ? AND deleted_at IS NULL)",
    )
    .bind(id)
    .fetch_one(conn)
    .await?)
}

/// R-01 (docs/03 Q3): tăng `next_task_no` và trả mã `<mã dự án>-<số>`. `None` = không có dự án.
pub async fn next_code(conn: &mut SqliteConnection, project_id: Id) -> AppResult<Option<String>> {
    Ok(sqlx::query_scalar::<_, String>(
        "UPDATE projects SET next_task_no = next_task_no + 1 WHERE id = ?
         RETURNING code || '-' || (next_task_no - 1)",
    )
    .bind(project_id)
    .fetch_optional(conn)
    .await?)
}

pub struct NewTask<'a> {
    pub code: &'a str,
    pub project_id: Id,
    pub title: &'a str,
    pub description: Option<&'a str>,
    pub status: &'a StatusFields,
    pub priority: i64,
    pub assignee_id: Option<Id>,
    pub creator_id: Id,
    pub start_date: Option<&'a str>,
    pub due_date: Option<&'a str>,
    pub now: i64,
}

pub async fn insert(conn: &mut SqliteConnection, t: &NewTask<'_>) -> AppResult<Id> {
    Ok(sqlx::query_scalar::<_, i64>(
        "INSERT INTO tasks (code, project_id, title, description, status, status_note, priority,
                            assignee_id, creator_id, start_date, due_date, actual_start_at,
                            actual_end_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id",
    )
    .bind(t.code)
    .bind(t.project_id)
    .bind(t.title)
    .bind(t.description)
    .bind(t.status.status.as_str())
    .bind(t.status.status_note.as_deref())
    .bind(t.priority)
    .bind(t.assignee_id)
    .bind(t.creator_id)
    .bind(t.start_date)
    .bind(t.due_date)
    .bind(t.status.actual_start_at)
    .bind(t.status.actual_end_at)
    .bind(t.now)
    .bind(t.now)
    .fetch_one(conn)
    .await?)
}

/// Ghi mọi cột sửa được (mã việc không bao giờ đổi) + `updated_at`.
pub async fn update_record(conn: &mut SqliteConnection, r: &TaskRecord, now: i64) -> AppResult<()> {
    sqlx::query(
        "UPDATE tasks SET project_id = ?, title = ?, description = ?, status = ?, status_note = ?,
                          priority = ?, assignee_id = ?, creator_id = ?, start_date = ?,
                          due_date = ?, actual_start_at = ?, actual_end_at = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(r.project_id)
    .bind(r.title.as_str())
    .bind(r.description.as_deref())
    .bind(r.status.as_str())
    .bind(r.status_note.as_deref())
    .bind(r.priority)
    .bind(r.assignee_id)
    .bind(r.creator_id)
    .bind(r.start_date.as_deref())
    .bind(r.due_date.as_deref())
    .bind(r.actual_start_at)
    .bind(r.actual_end_at)
    .bind(now)
    .bind(r.id)
    .execute(conn)
    .await?;
    Ok(())
}

/// Đặt `updated_at` (thay đổi việc con, bình luận, tệp).
pub async fn touch(conn: &mut SqliteConnection, id: Id, now: i64) -> AppResult<()> {
    sqlx::query("UPDATE tasks SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(id)
        .execute(conn)
        .await?;
    Ok(())
}

/// Chuyển vào Thùng rác. Trả số dòng đổi (0 = không có hoặc đã ở Thùng rác).
pub async fn move_to_trash(conn: &mut SqliteConnection, id: Id, now: i64) -> AppResult<u64> {
    Ok(sqlx::query(
        "UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(now)
    .bind(now)
    .bind(id)
    .execute(conn)
    .await?
    .rows_affected())
}

/// Khôi phục từ Thùng rác. Trả số dòng đổi (0 = không nằm trong Thùng rác).
pub async fn restore(conn: &mut SqliteConnection, id: Id, now: i64) -> AppResult<u64> {
    Ok(sqlx::query(
        "UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL",
    )
    .bind(now)
    .bind(id)
    .execute(conn)
    .await?
    .rows_affected())
}

/// docs/03 Q5: danh sách Thùng rác, mới xoá trước, kèm "Còn N ngày".
pub async fn list_trash(conn: &mut SqliteConnection, now: i64) -> AppResult<Vec<TrashRow>> {
    Ok(sqlx::query_as::<_, TrashRow>(
        "SELECT t.id, t.code, t.title, t.project_id, p.code AS project_code,
                p.name AS project_name, p.color AS project_color, t.deleted_at,
                ? - (? - t.deleted_at) / ? AS days_left
         FROM tasks t JOIN projects p ON p.id = t.project_id
         WHERE t.deleted_at IS NOT NULL
         ORDER BY t.deleted_at DESC, t.id DESC",
    )
    .bind(TRASH_RETENTION_DAYS)
    .bind(now)
    .bind(DAY_MS)
    .fetch_all(conn)
    .await?)
}

/// `stored_path` của tệp thuộc các việc trong Thùng rác sẽ bị xoá vĩnh viễn
/// (`id` None = mọi việc; `before` = chỉ việc xoá trước thời điểm này).
pub async fn trash_stored_paths(
    conn: &mut SqliteConnection,
    id: Option<Id>,
    before: Option<i64>,
) -> AppResult<Vec<String>> {
    Ok(sqlx::query_scalar::<_, String>(
        "SELECT a.stored_path FROM task_attachments a JOIN tasks t ON t.id = a.task_id
         WHERE t.deleted_at IS NOT NULL AND (?1 IS NULL OR t.id = ?1)
           AND (?2 IS NULL OR t.deleted_at < ?2)",
    )
    .bind(id)
    .bind(before)
    .fetch_all(conn)
    .await?)
}

/// R-07: xoá vĩnh viễn việc trong Thùng rác (CASCADE việc con, bình luận, dòng tệp, lịch sử).
pub async fn purge(
    conn: &mut SqliteConnection,
    id: Option<Id>,
    before: Option<i64>,
) -> AppResult<u64> {
    Ok(sqlx::query(
        "DELETE FROM tasks WHERE deleted_at IS NOT NULL AND (?1 IS NULL OR id = ?1)
           AND (?2 IS NULL OR deleted_at < ?2)",
    )
    .bind(id)
    .bind(before)
    .execute(conn)
    .await?
    .rows_affected())
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DashboardCounts {
    pub open_count: i64,
    pub overdue_count: i64,
    pub waiting_count: i64,
    pub done_this_week_count: i64,
}

/// docs/03 Q1: 4 số của Tổng quan.
pub async fn dashboard_counts(
    conn: &mut SqliteConnection,
    today: &str,
    week_start: i64,
    next_week_start: i64,
) -> AppResult<DashboardCounts> {
    Ok(sqlx::query_as::<_, DashboardCounts>(
        "SELECT COALESCE(SUM(status IN ('new', 'in_progress', 'waiting')), 0) AS open_count,
                COALESCE(SUM(status IN ('new', 'in_progress', 'waiting') AND due_date < ?1), 0)
                  AS overdue_count,
                COALESCE(SUM(status = 'waiting'), 0) AS waiting_count,
                COALESCE(SUM(status = 'done' AND actual_end_at >= ?2 AND actual_end_at < ?3), 0)
                  AS done_this_week_count
         FROM tasks WHERE deleted_at IS NULL",
    )
    .bind(today)
    .bind(week_start)
    .bind(next_week_start)
    .fetch_one(conn)
    .await?)
}

/// "Theo nhân viên": nhân viên đang làm việc, số việc đang mở / quá hạn mình phụ trách.
pub async fn workloads(
    conn: &mut SqliteConnection,
    today: &str,
) -> AppResult<Vec<EmployeeWorkload>> {
    Ok(sqlx::query_as::<_, EmployeeWorkload>(
        "SELECT e.id, e.full_name, e.color, e.is_self,
                COUNT(t.id) AS open_count,
                COALESCE(SUM(t.due_date < ?), 0) AS overdue_count
         FROM employees e
         LEFT JOIN tasks t ON t.assignee_id = e.id AND t.deleted_at IS NULL
                          AND t.status IN ('new', 'in_progress', 'waiting')
         WHERE e.status = 'active'
         GROUP BY e.id
         ORDER BY open_count DESC, e.is_self DESC, e.full_name, e.id",
    )
    .bind(today)
    .fetch_all(conn)
    .await?)
}

/// Họ tên + trạng thái nhân viên (kiểm tra R-03, chữ lịch sử).
pub async fn employee_brief(
    conn: &mut SqliteConnection,
    id: Id,
) -> AppResult<Option<(String, EmployeeStatus)>> {
    Ok(sqlx::query_as::<_, (String, EmployeeStatus)>(
        "SELECT full_name, status FROM employees WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(conn)
    .await?)
}

pub async fn project_name(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<String>> {
    Ok(
        sqlx::query_scalar::<_, String>("SELECT name FROM projects WHERE id = ?")
            .bind(id)
            .fetch_optional(conn)
            .await?,
    )
}
