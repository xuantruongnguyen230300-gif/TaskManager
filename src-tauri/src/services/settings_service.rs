//! Cài đặt (bảng `settings`, key `ui.theme` = light | dark | system; thiếu dòng = system). Chủ: B1.

use crate::db;
use crate::dto::{Settings, Theme, UpdateSettingsInput};
use crate::error::AppResult;
use crate::repo;
use crate::state::AppState;

pub const THEME_KEY: &str = "ui.theme";

fn theme_to_str(theme: Theme) -> &'static str {
    match theme {
        Theme::Light => "light",
        Theme::Dark => "dark",
        Theme::System => "system",
    }
}

fn theme_from_str(s: Option<&str>) -> Theme {
    match s {
        Some("light") => Theme::Light,
        Some("dark") => Theme::Dark,
        _ => Theme::System,
    }
}

/// `data_dir` = `state.data_dir`; `self_employee_id` = id của nhân viên `is_self = 1`.
pub async fn get_settings(state: &AppState) -> AppResult<Settings> {
    let mut conn = state.pool.acquire().await?;
    let theme = repo::settings::get(&mut conn, THEME_KEY).await?;
    let self_employee_id = repo::employees::self_id(&mut conn).await?;
    Ok(Settings {
        theme: theme_from_str(theme.as_deref()),
        data_dir: state.data_dir.to_string_lossy().to_string(),
        self_employee_id,
    })
}

pub async fn update_settings(state: &AppState, input: UpdateSettingsInput) -> AppResult<Settings> {
    let mut tx = db::begin_write(&state.pool).await?;
    repo::settings::set(&mut tx, THEME_KEY, theme_to_str(input.theme)).await?;
    tx.commit().await?;
    get_settings(state).await
}
