//! Dự án (R-01 mã, R-02 xoá). Chủ: B1.

use sqlx::{SqliteConnection, SqlitePool};

use crate::db;
use crate::domain::dates::now_ms;
use crate::domain::validate;
use crate::dto::{CreateProjectInput, Id, ProjectSummary, UpdateProjectInput};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::repo::projects as repo;

const NOT_FOUND_MSG: &str = "Không tìm thấy dự án.";
pub const DEFAULT_PROJECT_ID: Id = 1;

async fn summary(conn: &mut SqliteConnection, id: Id) -> AppResult<ProjectSummary> {
    repo::get_summary(conn, id)
        .await?
        .ok_or_else(|| AppError::not_found(NOT_FOUND_MSG))
}

/// Sắp theo `id` (Việc chung đầu tiên).
pub async fn list_projects(pool: &SqlitePool) -> AppResult<Vec<ProjectSummary>> {
    let mut conn = pool.acquire().await?;
    repo::list_summaries(&mut conn).await
}

/// Mã trùng → DUPLICATE_CODE. `next_task_no` theo công thức docs/03 Q3 (không sinh trùng mã cũ).
pub async fn create_project(
    pool: &SqlitePool,
    input: CreateProjectInput,
) -> AppResult<ProjectSummary> {
    let name = validate::project_name(&input.name)?;
    let code = validate::project_code(&input.code)?;
    let color = validate::color_hex(&input.color)?;
    let mut tx = db::begin_write(pool).await?;
    if repo::code_taken(&mut tx, &code, None).await? {
        return Err(validate::duplicate_project_code(&code));
    }
    let next_no = repo::next_no_for_code(&mut tx, &code).await?;
    let id = repo::insert(&mut tx, &code, &name, &color, next_no, now_ms()).await?;
    let result = summary(&mut tx, id).await?;
    tx.commit().await?;
    tracing::info!(id, "đã tạo dự án");
    Ok(result)
}

/// Đổi mã khi dự án đã có việc (kể cả Thùng rác) → VALIDATION field "code"
/// "Không đổi được mã vì dự án đã có việc."
pub async fn update_project(
    pool: &SqlitePool,
    input: UpdateProjectInput,
) -> AppResult<ProjectSummary> {
    let name = validate::project_name(&input.name)?;
    let code = validate::project_code(&input.code)?;
    let color = validate::color_hex(&input.color)?;
    let mut tx = db::begin_write(pool).await?;
    let current = repo::find(&mut tx, input.id)
        .await?
        .ok_or_else(|| AppError::not_found(NOT_FOUND_MSG))?;
    let mut next_no = None;
    if code != current.code {
        if repo::has_tasks(&mut tx, input.id).await? {
            return Err(AppError::validation(
                "code",
                "Không đổi được mã vì dự án đã có việc.",
            ));
        }
        if repo::code_taken(&mut tx, &code, Some(input.id)).await? {
            return Err(validate::duplicate_project_code(&code));
        }
        next_no = Some(repo::next_no_for_code(&mut tx, &code).await?);
    }
    repo::update(&mut tx, input.id, &code, &name, &color, next_no, now_ms()).await?;
    let result = summary(&mut tx, input.id).await?;
    tx.commit().await?;
    Ok(result)
}

/// id = 1 → PROJECT_PROTECTED; còn việc (kể cả Thùng rác) → PROJECT_NOT_EMPTY.
pub async fn delete_project(pool: &SqlitePool, id: Id) -> AppResult<()> {
    if id == DEFAULT_PROJECT_ID {
        return Err(AppError::new(
            ErrorCode::ProjectProtected,
            "Không thể xoá dự án Việc chung.",
        ));
    }
    let mut tx = db::begin_write(pool).await?;
    repo::find(&mut tx, id)
        .await?
        .ok_or_else(|| AppError::not_found(NOT_FOUND_MSG))?;
    if repo::has_tasks(&mut tx, id).await? {
        return Err(AppError::new(
            ErrorCode::ProjectNotEmpty,
            "Chỉ xoá được dự án không còn việc nào (kể cả trong Thùng rác).",
        ));
    }
    repo::delete(&mut tx, id).await?;
    tx.commit().await?;
    tracing::info!(id, "đã xoá dự án");
    Ok(())
}
