use tauri::State;

use crate::dto::{CreateProjectInput, Id, ProjectSummary, UpdateProjectInput};
use crate::error::AppResult;
use crate::services::project_service;
use crate::state::AppState;

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> AppResult<Vec<ProjectSummary>> {
    project_service::list_projects(&state.pool).await
}

#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> AppResult<ProjectSummary> {
    project_service::create_project(&state.pool, input).await
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, AppState>,
    input: UpdateProjectInput,
) -> AppResult<ProjectSummary> {
    project_service::update_project(&state.pool, input).await
}

/// R-02: chỉ xoá được dự án không còn việc nào (kể cả Thùng rác); "Việc chung" không xoá được.
#[tauri::command]
pub async fn delete_project(state: State<'_, AppState>, id: Id) -> AppResult<()> {
    project_service::delete_project(&state.pool, id).await
}
