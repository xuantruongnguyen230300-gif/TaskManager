use tauri::State;

use crate::dto::{Settings, UpdateSettingsInput};
use crate::error::AppResult;
use crate::services::settings_service;
use crate::state::AppState;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<Settings> {
    settings_service::get_settings(&state).await
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    input: UpdateSettingsInput,
) -> AppResult<Settings> {
    settings_service::update_settings(&state, input).await
}
