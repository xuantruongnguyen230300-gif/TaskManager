use tauri::State;

use crate::dto::{AddCommentInput, Comment, Id};
use crate::error::AppResult;
use crate::services::task_service;
use crate::state::AppState;

#[tauri::command]
pub async fn add_comment(state: State<'_, AppState>, input: AddCommentInput) -> AppResult<Comment> {
    task_service::add_comment(&state.pool, input).await
}

#[tauri::command]
pub async fn delete_comment(state: State<'_, AppState>, id: Id) -> AppResult<()> {
    task_service::delete_comment(&state.pool, id).await
}
