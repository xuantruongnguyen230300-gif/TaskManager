//! Nhân viên (R-03, R-04, R-05). Chủ: B1.

use sqlx::SqlitePool;

use crate::db;
use crate::domain::dates::{Clock, DAY_MS};
use crate::domain::labels;
use crate::domain::text::{contains_folded, fold_vi};
use crate::domain::validate;
use crate::dto::{
    CreateEmployeeInput, DeactivateEmployeeInput, DeactivateResult, EmployeeDetail, EmployeeRow,
    EmployeeStatusFilter, HistoryField, Id, ListEmployeesInput, UpdateEmployeeInput,
};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::repo::employees::{self as repo, EmployeeBase, EmployeeData};
use crate::services::history::{self, Change};

const NOT_FOUND_MSG: &str = "Không tìm thấy nhân viên.";
const SELF_MSG: &str = "Không thể xoá hoặc chuyển Đã nghỉ hồ sơ “Tôi”.";

fn validate_data(
    full_name: &str,
    title: Option<&str>,
    phone: Option<&str>,
    email: Option<&str>,
    color: &str,
) -> AppResult<EmployeeData> {
    Ok(EmployeeData {
        full_name: validate::employee_name(full_name)?,
        title: validate::employee_title(title)?,
        phone: validate::employee_phone(phone)?,
        email: validate::employee_email(email)?,
        color: validate::color_hex(color)?,
    })
}

async fn find_existing(conn: &mut sqlx::SqliteConnection, id: Id) -> AppResult<EmployeeBase> {
    repo::find(conn, id)
        .await?
        .ok_or_else(|| AppError::not_found(NOT_FOUND_MSG))
}

/// Lọc trạng thái + tìm tên không dấu (`fold_vi`). Sắp: "Tôi" đầu tiên, rồi theo tên.
pub async fn list_employees(
    pool: &SqlitePool,
    input: ListEmployeesInput,
) -> AppResult<Vec<EmployeeRow>> {
    let status = match input.status {
        EmployeeStatusFilter::Active => Some("active"),
        EmployeeStatusFilter::Inactive => Some("inactive"),
        EmployeeStatusFilter::All => None,
    };
    let clock = Clock::now();
    let mut conn = pool.acquire().await?;
    let rows = repo::list(&mut conn, status, &clock.today).await?;
    let q = input.q.unwrap_or_default();
    let mut rows: Vec<(String, EmployeeRow)> = rows
        .into_iter()
        .filter(|r| contains_folded(&r.full_name, &q))
        .map(|r| (fold_vi(&r.full_name), r))
        .collect();
    rows.sort_by(|(ka, a), (kb, b)| {
        b.is_self
            .cmp(&a.is_self)
            .then_with(|| ka.cmp(kb))
            .then_with(|| a.full_name.cmp(&b.full_name))
            .then_with(|| a.id.cmp(&b.id))
    });
    Ok(rows.into_iter().map(|(_, r)| r).collect())
}

pub async fn get_employee(pool: &SqlitePool, id: Id) -> AppResult<EmployeeDetail> {
    let clock = Clock::now();
    let mut conn = pool.acquire().await?;
    repo::get_detail(&mut conn, id, &clock.today, clock.now_ms - 30 * DAY_MS)
        .await?
        .ok_or_else(|| AppError::not_found(NOT_FOUND_MSG))
}

pub async fn create_employee(
    pool: &SqlitePool,
    input: CreateEmployeeInput,
) -> AppResult<EmployeeDetail> {
    let data = validate_data(
        &input.full_name,
        input.title.as_deref(),
        input.phone.as_deref(),
        input.email.as_deref(),
        &input.color,
    )?;
    let now = Clock::now().now_ms;
    let mut tx = db::begin_write(pool).await?;
    let id = repo::insert(&mut tx, &data, "active", now).await?;
    tx.commit().await?;
    tracing::info!(id, "đã thêm nhân viên");
    get_employee(pool, id).await
}

pub async fn update_employee(
    pool: &SqlitePool,
    input: UpdateEmployeeInput,
) -> AppResult<EmployeeDetail> {
    let data = validate_data(
        &input.full_name,
        input.title.as_deref(),
        input.phone.as_deref(),
        input.email.as_deref(),
        &input.color,
    )?;
    let now = Clock::now().now_ms;
    let mut tx = db::begin_write(pool).await?;
    find_existing(&mut tx, input.id).await?;
    repo::update(&mut tx, input.id, &data, now).await?;
    tx.commit().await?;
    get_employee(pool, input.id).await
}

/// "Tôi" → SELF_PROTECTED; đã có việc (phụ trách/tạo) hoặc bình luận → EMPLOYEE_IN_USE.
pub async fn delete_employee(pool: &SqlitePool, id: Id) -> AppResult<()> {
    let mut tx = db::begin_write(pool).await?;
    let emp = find_existing(&mut tx, id).await?;
    if emp.is_self {
        return Err(AppError::new(ErrorCode::SelfProtected, SELF_MSG));
    }
    if repo::is_in_use(&mut tx, id).await? {
        return Err(AppError::new(
            ErrorCode::EmployeeInUse,
            format!(
                "{} đã có việc hoặc bình luận nên không xoá được, chỉ có thể chuyển sang Đã nghỉ.",
                emp.full_name
            ),
        ));
    }
    repo::delete(&mut tx, id).await?;
    tx.commit().await?;
    tracing::info!(id, "đã xoá nhân viên");
    Ok(())
}

/// Giao lại việc Mới/Đang làm/Đang chờ cho `reassign_to` (phải đang làm việc) hoặc Chưa giao,
/// ghi lịch sử "assignee" cho từng việc, rồi đặt status = inactive. Một transaction.
pub async fn deactivate_employee(
    pool: &SqlitePool,
    input: DeactivateEmployeeInput,
) -> AppResult<DeactivateResult> {
    let now = Clock::now().now_ms;
    let mut tx = db::begin_write(pool).await?;
    let emp = find_existing(&mut tx, input.id).await?;
    if emp.is_self {
        return Err(AppError::new(ErrorCode::SelfProtected, SELF_MSG));
    }
    let target = match input.reassign_to {
        None => None,
        Some(tid) => {
            let t = repo::find(&mut tx, tid).await?;
            match t {
                Some(t) if t.id != emp.id && t.is_active() => Some(t),
                _ => {
                    return Err(AppError::validation(
                        "reassignTo",
                        "Chỉ giao được cho nhân viên đang làm việc.",
                    ))
                }
            }
        }
    };
    let new_label = target
        .as_ref()
        .map_or_else(|| labels::UNASSIGNED.to_string(), |t| t.full_name.clone());
    let task_ids = repo::open_task_ids(&mut tx, emp.id).await?;
    let change = Change::new(
        HistoryField::Assignee,
        Some(emp.full_name.clone()),
        Some(new_label),
    );
    for task_id in &task_ids {
        repo::reassign_task(&mut tx, *task_id, target.as_ref().map(|t| t.id), now).await?;
        history::record(&mut tx, *task_id, now, std::slice::from_ref(&change)).await?;
    }
    repo::set_status(&mut tx, emp.id, "inactive", now).await?;
    tx.commit().await?;
    let reassigned_count = i64::try_from(task_ids.len()).unwrap_or(i64::MAX);
    tracing::info!(
        id = emp.id,
        reassigned_count,
        "đã chuyển nhân viên sang Đã nghỉ"
    );
    Ok(DeactivateResult { reassigned_count })
}

/// "Làm việc lại": Đã nghỉ → Đang làm việc.
pub async fn reactivate_employee(pool: &SqlitePool, id: Id) -> AppResult<()> {
    let now = Clock::now().now_ms;
    let mut tx = db::begin_write(pool).await?;
    let emp = find_existing(&mut tx, id).await?;
    if !emp.is_active() {
        repo::set_status(&mut tx, id, "active", now).await?;
    }
    tx.commit().await?;
    Ok(())
}
