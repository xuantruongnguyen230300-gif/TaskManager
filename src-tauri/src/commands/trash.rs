use tauri::State;

use crate::dto::{Id, TrashRow};
use crate::error::AppResult;
use crate::services::trash_service;
use crate::state::AppState;

/// Dọn việc quá 30 ngày trước rồi mới trả danh sách (docs/05 §5).
#[tauri::command]
pub async fn list_trash(state: State<'_, AppState>) -> AppResult<Vec<TrashRow>> {
    trash_service::list_trash(&state).await
}

#[tauri::command]
pub async fn restore_task(state: State<'_, AppState>, id: Id) -> AppResult<()> {
    trash_service::restore_task(&state.pool, id).await
}

#[tauri::command]
pub async fn purge_task(state: State<'_, AppState>, id: Id) -> AppResult<()> {
    trash_service::purge_task(&state, id).await
}

#[tauri::command]
pub async fn empty_trash(state: State<'_, AppState>) -> AppResult<()> {
    trash_service::empty_trash(&state).await
}
