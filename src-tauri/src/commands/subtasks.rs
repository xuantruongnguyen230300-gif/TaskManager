use tauri::State;

use crate::dto::{AddSubtaskInput, Id, Subtask, UpdateSubtaskInput};
use crate::error::AppResult;
use crate::services::task_service;
use crate::state::AppState;

#[tauri::command]
pub async fn add_subtask(state: State<'_, AppState>, input: AddSubtaskInput) -> AppResult<Subtask> {
    task_service::add_subtask(&state.pool, input).await
}

#[tauri::command]
pub async fn update_subtask(
    state: State<'_, AppState>,
    input: UpdateSubtaskInput,
) -> AppResult<Subtask> {
    task_service::update_subtask(&state.pool, input).await
}

#[tauri::command]
pub async fn delete_subtask(state: State<'_, AppState>, id: Id) -> AppResult<()> {
    task_service::delete_subtask(&state.pool, id).await
}
