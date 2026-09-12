use tauri::State;

use crate::error::AppResult;
use crate::state::AppState;

/// CHỈ BẢN DEBUG: nạp dữ liệu mẫu giống prototype (7 nhân viên, dự án VC/WEB/APP/MKT/NB, ~20 việc).
/// Bản release: mã seed không được biên dịch, command trả NOT_FOUND.
#[tauri::command]
pub async fn dev_seed_sample_data(state: State<'_, AppState>) -> AppResult<()> {
    #[cfg(debug_assertions)]
    {
        crate::services::dev_seed::seed_sample_data(&state.pool).await
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = state;
        Err(crate::error::AppError::not_found("Không có chức năng này."))
    }
}
