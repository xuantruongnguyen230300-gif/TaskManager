use tauri::State;

use crate::dto::Dashboard;
use crate::error::AppResult;
use crate::services::dashboard_service;
use crate::state::AppState;

#[tauri::command]
pub async fn get_dashboard(state: State<'_, AppState>) -> AppResult<Dashboard> {
    dashboard_service::get_dashboard(&state.pool).await
}
