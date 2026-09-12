//! Truy cập SQLite bằng sqlx RUNTIME (`sqlx::query`, `query_as` + `FromRow`), KHÔNG dùng macro `query!`.
//! Hàm nhận `&mut SqliteConnection` (service truyền `&mut *tx` hoặc `&mut *pool.acquire().await?`)
//! để service ghép nhiều hàm trong một transaction. Repo không biết quy tắc nghiệp vụ.
//! SQL luôn tham số hoá (`?`). SQL ghép động (hiếm) phải bọc `sqlx::AssertSqlSafe(...)`.

pub mod attachments;
pub mod comments;
pub mod employees;
pub mod history;
pub mod projects;
pub mod settings;
pub mod subtasks;
pub mod tasks;
