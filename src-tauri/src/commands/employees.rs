use tauri::State;

use crate::dto::{
    CreateEmployeeInput, DeactivateEmployeeInput, DeactivateResult, EmployeeDetail, EmployeeRow,
    Id, ListEmployeesInput, UpdateEmployeeInput,
};
use crate::error::AppResult;
use crate::services::employee_service;
use crate::state::AppState;

#[tauri::command]
pub async fn list_employees(
    state: State<'_, AppState>,
    input: ListEmployeesInput,
) -> AppResult<Vec<EmployeeRow>> {
    employee_service::list_employees(&state.pool, input).await
}

#[tauri::command]
pub async fn get_employee(state: State<'_, AppState>, id: Id) -> AppResult<EmployeeDetail> {
    employee_service::get_employee(&state.pool, id).await
}

#[tauri::command]
pub async fn create_employee(
    state: State<'_, AppState>,
    input: CreateEmployeeInput,
) -> AppResult<EmployeeDetail> {
    employee_service::create_employee(&state.pool, input).await
}

/// Sửa nhân viên, kể cả hồ sơ "Tôi" (SC-9).
#[tauri::command]
pub async fn update_employee(
    state: State<'_, AppState>,
    input: UpdateEmployeeInput,
) -> AppResult<EmployeeDetail> {
    employee_service::update_employee(&state.pool, input).await
}

/// R-05: chỉ xoá người chưa có việc/bình luận → lỗi EMPLOYEE_IN_USE.
#[tauri::command]
pub async fn delete_employee(state: State<'_, AppState>, id: Id) -> AppResult<()> {
    employee_service::delete_employee(&state.pool, id).await
}

/// R-04: chuyển Đã nghỉ + giao lại việc chưa xong (ghi lịch sử từng việc).
#[tauri::command]
pub async fn deactivate_employee(
    state: State<'_, AppState>,
    input: DeactivateEmployeeInput,
) -> AppResult<DeactivateResult> {
    employee_service::deactivate_employee(&state.pool, input).await
}

/// Nút "Làm việc lại" ở SC-7: Đã nghỉ → Đang làm việc.
#[tauri::command]
pub async fn reactivate_employee(state: State<'_, AppState>, id: Id) -> AppResult<()> {
    employee_service::reactivate_employee(&state.pool, id).await
}
