//! Điểm vào Tauri: plugin, setup (thư mục dữ liệu, log, DB), đăng ký command.
//!
//! Tầng: commands (mỏng) → services (quy tắc, transaction, lịch sử) → repo (sqlx) → SQLite.
//! `domain` là Rust thuần, tầng nào cũng dùng được. Xem docs/05.

pub mod commands;
pub mod db;
pub mod domain;
pub mod dto;
pub mod error;
pub mod repo;
pub mod services;
pub mod state;

use std::path::{Path, PathBuf};

use tauri::Manager;

pub use error::{AppError, AppResult, ErrorCode};
pub use state::AppState;

/// Giữ luồng ghi log sống suốt vòng đời app.
struct LogGuard(#[allow(dead_code)] tracing_appender::non_blocking::WorkerGuard);

pub fn run() {
    let result = tauri::Builder::default()
        // single-instance PHẢI đăng ký đầu tiên: lần mở thứ hai chỉ focus cửa sổ cũ.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            setup(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Tổng quan
            commands::dashboard::get_dashboard,
            // Việc
            commands::tasks::list_tasks,
            commands::tasks::get_task,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::set_task_status,
            commands::tasks::delete_task,
            // Việc con
            commands::subtasks::add_subtask,
            commands::subtasks::update_subtask,
            commands::subtasks::delete_subtask,
            // Bình luận
            commands::comments::add_comment,
            commands::comments::delete_comment,
            // Tệp
            commands::attachments::pick_files,
            commands::attachments::add_attachments,
            commands::attachments::remove_attachment,
            commands::attachments::open_attachment,
            // Dự án
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            // Nhân viên
            commands::employees::list_employees,
            commands::employees::get_employee,
            commands::employees::create_employee,
            commands::employees::update_employee,
            commands::employees::delete_employee,
            commands::employees::deactivate_employee,
            commands::employees::reactivate_employee,
            // Thùng rác
            commands::trash::list_trash,
            commands::trash::restore_task,
            commands::trash::purge_task,
            commands::trash::empty_trash,
            // Cài đặt
            commands::settings::get_settings,
            commands::settings::update_settings,
            // Dữ liệu
            commands::data::backup_to_zip,
            commands::data::restore_from_zip,
            // Chỉ bản debug (bản release trả lỗi NOT_FOUND)
            commands::dev::dev_seed_sample_data,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        tracing::error!(error = %e, "không chạy được ứng dụng");
        eprintln!("Không chạy được ứng dụng: {e}");
    }
}

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = resolve_data_dir(app.handle())?;
    for dir in [
        data_dir.clone(),
        state::attachments_dir(&data_dir),
        state::backups_dir(&data_dir),
        state::logs_dir(&data_dir),
    ] {
        std::fs::create_dir_all(dir)?;
    }
    if let Some(guard) = init_logging(&data_dir) {
        app.manage(LogGuard(guard));
    }
    tracing::info!(version = env!("CARGO_PKG_VERSION"), "khởi động");
    let state = tauri::async_runtime::block_on(startup(data_dir))?;
    app.manage(state);
    Ok(())
}

/// Bản release: `%APPDATA%\vn.personal.quanlytask\`. Bản debug: thư mục con `dev\` (tách dữ liệu dev).
fn resolve_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, tauri::Error> {
    let base = app.path().app_data_dir()?;
    Ok(if cfg!(debug_assertions) {
        base.join("dev")
    } else {
        base
    })
}

/// Khôi phục đang chờ → mở DB + migrate → dọn Thùng rác quá 30 ngày (docs/05 §5).
async fn startup(data_dir: PathBuf) -> AppResult<AppState> {
    services::data_service::apply_pending_restore(&data_dir)?;
    let pool = db::open_and_migrate(&data_dir).await?;
    let state = AppState::new(pool, data_dir);
    if let Err(e) = services::trash_service::purge_expired(&state).await {
        tracing::warn!(code = ?e.code, "không dọn được Thùng rác lúc khởi động");
    }
    Ok(state)
}

/// Log ra `logs/app.<ngày>.log`, xoay theo ngày, giữ 7 file. Chỉ ghi mã lỗi và id.
fn init_logging(data_dir: &Path) -> Option<tracing_appender::non_blocking::WorkerGuard> {
    let appender = tracing_appender::rolling::Builder::new()
        .rotation(tracing_appender::rolling::Rotation::DAILY)
        .filename_prefix("app")
        .filename_suffix("log")
        .max_log_files(7)
        .build(state::logs_dir(data_dir))
        .ok()?;
    let (writer, guard) = tracing_appender::non_blocking(appender);
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,sqlx=warn"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(writer)
        .with_ansi(false)
        .try_init()
        .ok()?;
    Some(guard)
}
