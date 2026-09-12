use tauri::{AppHandle, State};

use crate::dto::{AddAttachmentsInput, Attachment, Id, PickedFile};
use crate::error::AppResult;
use crate::services::attachment_service;
use crate::state::AppState;

/// Rust mở hộp thoại chọn tệp (JS không có quyền dialog). Huỷ → mảng rỗng.
#[tauri::command]
pub async fn pick_files(app: AppHandle) -> AppResult<Vec<PickedFile>> {
    attachment_service::pick_files(&app).await
}

#[tauri::command]
pub async fn add_attachments(
    state: State<'_, AppState>,
    input: AddAttachmentsInput,
) -> AppResult<Vec<Attachment>> {
    attachment_service::add_attachments(&state, input).await
}

#[tauri::command]
pub async fn remove_attachment(state: State<'_, AppState>, id: Id) -> AppResult<()> {
    attachment_service::remove_attachment(&state, id).await
}

/// Mở bằng ứng dụng mặc định của Windows (chỉ tệp trong `attachments/`).
#[tauri::command]
pub async fn open_attachment(app: AppHandle, state: State<'_, AppState>, id: Id) -> AppResult<()> {
    attachment_service::open_attachment(&app, &state, id).await
}
