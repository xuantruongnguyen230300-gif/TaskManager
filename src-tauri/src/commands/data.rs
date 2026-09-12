use tauri::{AppHandle, State};

use crate::dto::BackupResult;
use crate::error::AppResult;
use crate::services::data_service;
use crate::state::AppState;

/// Rust mở hộp thoại lưu `.zip`. Huỷ → `None` (JS nhận `null`).
#[tauri::command]
pub async fn backup_to_zip(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<Option<BackupResult>> {
    data_service::backup_to_zip(&app, &state).await
}

/// Rust mở hộp thoại chọn `.zip`. Huỷ → trả về bình thường; thành công → app khởi động lại.
#[tauri::command]
pub async fn restore_from_zip(app: AppHandle, state: State<'_, AppState>) -> AppResult<()> {
    data_service::restore_from_zip(&app, &state).await
}
