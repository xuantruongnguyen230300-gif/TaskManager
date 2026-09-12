//! Trạng thái dùng chung, `app.manage(AppState)` trong `lib.rs`.
//! Command lấy bằng `state: tauri::State<'_, AppState>`.

use std::path::{Path, PathBuf};

use sqlx::SqlitePool;

pub struct AppState {
    pub pool: SqlitePool,
    /// Thư mục dữ liệu: release = `%APPDATA%\vn.personal.quanlytask\`, debug = `...\dev\`.
    pub data_dir: PathBuf,
}

impl AppState {
    pub fn new(pool: SqlitePool, data_dir: PathBuf) -> Self {
        Self { pool, data_dir }
    }

    pub fn attachments_dir(&self) -> PathBuf {
        attachments_dir(&self.data_dir)
    }

    pub fn backups_dir(&self) -> PathBuf {
        backups_dir(&self.data_dir)
    }
}

pub const DB_FILE: &str = "quanlytask.db";
pub const ATTACHMENTS_DIR: &str = "attachments";
pub const BACKUPS_DIR: &str = "backups";
pub const LOGS_DIR: &str = "logs";
pub const RESTORE_PENDING_DIR: &str = "restore-pending";

pub fn db_path(data_dir: &Path) -> PathBuf {
    data_dir.join(DB_FILE)
}

pub fn attachments_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(ATTACHMENTS_DIR)
}

pub fn backups_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(BACKUPS_DIR)
}

pub fn logs_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(LOGS_DIR)
}

pub fn restore_pending_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(RESTORE_PENDING_DIR)
}
