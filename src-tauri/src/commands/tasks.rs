use tauri::State;

use crate::dto::{
    CreateTaskInput, Id, SetTaskStatusInput, TaskDetail, TaskFilter, TaskRow, UpdateTaskInput,
};
use crate::error::AppResult;
use crate::services::task_service;
use crate::state::AppState;

#[tauri::command]
pub async fn list_tasks(state: State<'_, AppState>, filter: TaskFilter) -> AppResult<Vec<TaskRow>> {
    task_service::list_tasks(&state.pool, filter).await
}

#[tauri::command]
pub async fn get_task(state: State<'_, AppState>, id: Id) -> AppResult<TaskDetail> {
    task_service::get_task(&state.pool, id).await
}

#[tauri::command]
pub async fn create_task(
    state: State<'_, AppState>,
    input: CreateTaskInput,
) -> AppResult<TaskDetail> {
    task_service::create_task(&state, input).await
}

#[tauri::command]
pub async fn update_task(
    state: State<'_, AppState>,
    input: UpdateTaskInput,
) -> AppResult<TaskDetail> {
    task_service::update_task(&state, input).await
}

#[tauri::command]
pub async fn set_task_status(
    state: State<'_, AppState>,
    input: SetTaskStatusInput,
) -> AppResult<TaskDetail> {
    task_service::set_task_status(&state.pool, input).await
}

/// Chuyển vào Thùng rác (R-07).
#[tauri::command]
pub async fn delete_task(state: State<'_, AppState>, id: Id) -> AppResult<()> {
    task_service::delete_task(&state.pool, id).await
}
