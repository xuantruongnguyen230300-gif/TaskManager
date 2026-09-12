//! Sao lưu / khôi phục `.zip` (R-10, docs/03 §6, docs/05 §6). Chủ: B2.
//! Việc IO nặng chạy trong `spawn_blocking`.

use std::ffi::OsString;
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Seek, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Connection, SqlitePool};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::db;
use crate::domain::dates;
use crate::dto::BackupResult;
use crate::error::{AppError, AppResult, ErrorCode};
use crate::repo;
use crate::services::attachment_service::{self, run_blocking};
use crate::state::{self, AppState};

/// Phiên bản schema ghi vào `manifest.json` (= số migration mới nhất).
pub const SCHEMA_VERSION: i64 = 1;

const MANIFEST: &str = "manifest.json";
/// Đánh dấu `restore-pending/` đã giải nén và kiểm tra xong.
const READY_MARKER: &str = ".ready";
const AUTO_PREFIX: &str = "auto-before-restore-";
const KEEP_AUTO_BACKUPS: usize = 5;
const ZIP_FILTER: &str = "Tệp sao lưu Quản lý Task";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    app_version: String,
    schema_version: i64,
    created_at: i64,
    db_sha256: String,
}

/// Hộp thoại lưu → `VACUUM INTO` tệp tạm → zip (manifest.json, quanlytask.db, attachments/*).
/// Huỷ → `Ok(None)`.
pub async fn backup_to_zip(app: &AppHandle, state: &AppState) -> AppResult<Option<BackupResult>> {
    let name = format!(
        "QuanLyTask-{}.zip",
        chrono::Local::now().format("%Y-%m-%d_%H%M")
    );
    let handle = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        handle
            .dialog()
            .file()
            .add_filter(ZIP_FILTER, &["zip"])
            .set_file_name(name)
            .blocking_save_file()
    })
    .await?;
    let Some(dest) = picked
        .as_ref()
        .and_then(|p| p.as_path())
        .map(Path::to_path_buf)
    else {
        return Ok(None);
    };
    let dest = if dest
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("zip"))
    {
        dest
    } else {
        with_suffix(&dest, ".zip")
    };
    create_backup(&state.pool, &state.data_dir, &dest).await?;
    tracing::info!("đã sao lưu dữ liệu");
    Ok(Some(BackupResult {
        path: dest.to_string_lossy().into_owned(),
    }))
}

/// Hộp thoại chọn zip → kiểm tra manifest/SHA-256/zip-slip → giải nén vào `restore-pending/`
/// → integrity_check → tự sao lưu hiện tại → khởi động lại. Huỷ → `Ok(())`.
pub async fn restore_from_zip(app: &AppHandle, state: &AppState) -> AppResult<()> {
    let handle = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        handle
            .dialog()
            .file()
            .add_filter(ZIP_FILTER, &["zip"])
            .blocking_pick_file()
    })
    .await?;
    let Some(zip_path) = picked
        .as_ref()
        .and_then(|p| p.as_path())
        .map(Path::to_path_buf)
    else {
        return Ok(());
    };
    prepare_restore(&state.pool, &state.data_dir, &zip_path).await?;
    tracing::info!("khôi phục: đóng dữ liệu và khởi động lại");
    state.pool.close().await;
    // Nhả khoá single-instance để tiến trình mới mở được.
    tauri_plugin_single_instance::destroy(app);
    app.request_restart();
    Ok(())
}

/// Lúc khởi động, TRƯỚC khi mở pool: nếu có `restore-pending/` (đã kiểm tra xong) thì thay DB
/// + `attachments/`. Bản dở dang (thiếu `.ready`) bị bỏ.
pub fn apply_pending_restore(data_dir: &Path) -> AppResult<()> {
    let pending = state::restore_pending_dir(data_dir);
    if !pending.exists() {
        return Ok(());
    }
    let new_db = pending.join(state::DB_FILE);
    if !pending.join(READY_MARKER).is_file() || !new_db.is_file() {
        tracing::warn!("bỏ bản khôi phục chưa hoàn tất");
        fs::remove_dir_all(&pending)?;
        return Ok(());
    }
    let db_file = state::db_path(data_dir);
    for suffix in ["", "-wal", "-shm"] {
        remove_if_exists(&with_suffix(&db_file, suffix))?;
    }
    fs::rename(&new_db, &db_file)?;
    for suffix in ["-wal", "-shm"] {
        let side = with_suffix(&new_db, suffix);
        if side.exists() {
            fs::rename(&side, with_suffix(&db_file, suffix))?;
        }
    }
    let att = state::attachments_dir(data_dir);
    if att.exists() {
        fs::remove_dir_all(&att)?;
    }
    let new_att = pending.join(state::ATTACHMENTS_DIR);
    if new_att.is_dir() {
        fs::rename(&new_att, &att)?;
    } else {
        fs::create_dir_all(&att)?;
    }
    fs::remove_dir_all(&pending)?;
    tracing::info!("đã áp dụng bản khôi phục");
    Ok(())
}

/// Tạo file sao lưu `dest` từ dữ liệu hiện tại (dùng cho nút Sao lưu và bản tự sao lưu).
pub async fn create_backup(pool: &SqlitePool, data_dir: &Path, dest: &Path) -> AppResult<()> {
    let tmp_dir = state::backups_dir(data_dir);
    fs::create_dir_all(&tmp_dir)?;
    let tmp_db = tmp_dir.join(format!("tmp-{}.db", uuid::Uuid::new_v4().simple()));
    sqlx::query("VACUUM INTO ?")
        .bind(tmp_db.to_string_lossy().into_owned())
        .execute(pool)
        .await?;
    let stored = {
        let mut conn = pool.acquire().await?;
        repo::attachments::all_stored_paths(&mut conn).await?
    };
    let att_dir = state::attachments_dir(data_dir);
    let (db_copy, dest) = (tmp_db.clone(), dest.to_path_buf());
    let result = run_blocking(move || write_zip(&db_copy, &att_dir, &stored, &dest)).await;
    if let Err(e) = fs::remove_file(&tmp_db) {
        tracing::warn!(kind = ?e.kind(), "không xoá được DB tạm của bản sao lưu");
    }
    result
}

/// Kiểm tra + giải nén `zip_path` vào `restore-pending/`, rồi tự sao lưu dữ liệu hiện tại.
/// Lỗi → xoá `restore-pending/`, dữ liệu hiện tại không đổi.
pub async fn prepare_restore(pool: &SqlitePool, data_dir: &Path, zip_path: &Path) -> AppResult<()> {
    let pending = state::restore_pending_dir(data_dir);
    let result = async {
        let (zp, pd) = (zip_path.to_path_buf(), pending.clone());
        run_blocking(move || extract_backup(&zp, &pd)).await?;
        check_integrity(&pending.join(state::DB_FILE)).await?;
        let backups = state::backups_dir(data_dir);
        let auto = backups.join(format!(
            "{AUTO_PREFIX}{}.zip",
            chrono::Local::now().format("%Y%m%d-%H%M%S")
        ));
        create_backup(pool, data_dir, &auto).await?;
        db::prune_backups(&backups, AUTO_PREFIX, KEEP_AUTO_BACKUPS);
        fs::write(pending.join(READY_MARKER), b"ok")?;
        Ok(())
    }
    .await;
    if result.is_err() && pending.exists() {
        if let Err(e) = fs::remove_dir_all(&pending) {
            tracing::warn!(kind = ?e.kind(), "không xoá được restore-pending");
        }
    }
    result
}

fn write_zip(db_file: &Path, att_dir: &Path, stored: &[String], dest: &Path) -> AppResult<()> {
    let manifest = Manifest {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        schema_version: SCHEMA_VERSION,
        created_at: dates::now_ms(),
        db_sha256: sha256_file(db_file)?,
    };
    let part = with_suffix(dest, ".part");
    match write_zip_entries(&part, &manifest, db_file, att_dir, stored) {
        Ok(()) => {
            fs::rename(&part, dest)?;
            Ok(())
        }
        Err(e) => {
            let _ = fs::remove_file(&part);
            Err(e)
        }
    }
}

fn write_zip_entries(
    part: &Path,
    manifest: &Manifest,
    db_file: &Path,
    att_dir: &Path,
    stored: &[String],
) -> AppResult<()> {
    let mut zip = ZipWriter::new(BufWriter::new(File::create(part)?));
    let deflated = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let plain = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    zip.start_file(MANIFEST, deflated)?;
    zip.write_all(&serde_json::to_vec_pretty(manifest)?)?;
    zip.start_file(state::DB_FILE, deflated)?;
    io::copy(&mut File::open(db_file)?, &mut zip)?;
    for sp in stored {
        let Some(name) = attachment_service::stored_file_name(sp) else {
            continue;
        };
        let Ok(mut src) = File::open(att_dir.join(name)) else {
            tracing::warn!("thiếu tệp đính kèm khi sao lưu");
            continue;
        };
        zip.start_file(format!("{}/{name}", state::ATTACHMENTS_DIR), plain)?;
        io::copy(&mut src, &mut zip)?;
    }
    zip.finish()?.flush()?;
    Ok(())
}

/// Mục hợp lệ trong zip sao lưu.
enum Entry<'a> {
    Manifest,
    Db,
    AttachmentsDir,
    Attachment(&'a str),
}

/// Chỉ nhận `manifest.json`, `quanlytask.db` ở gốc và tệp đơn dưới `attachments/` (chặn zip-slip).
fn classify(name: &str) -> Option<Entry<'_>> {
    match name {
        MANIFEST => Some(Entry::Manifest),
        state::DB_FILE => Some(Entry::Db),
        "attachments/" => Some(Entry::AttachmentsDir),
        _ => name
            .strip_prefix("attachments/")
            .filter(|n| attachment_service::is_plain_name(n))
            .map(Entry::Attachment),
    }
}

fn extract_backup(zip_path: &Path, pending: &Path) -> AppResult<()> {
    if pending.exists() {
        fs::remove_dir_all(pending)?;
    }
    let file = File::open(zip_path)?;
    let mut zip = ZipArchive::new(BufReader::new(file)).map_err(|_| restore_invalid())?;
    let manifest = read_manifest(&mut zip)?;
    if manifest.schema_version > SCHEMA_VERSION {
        return Err(restore_newer());
    }
    let mut has_db = false;
    for i in 0..zip.len() {
        let entry = zip.by_index(i).map_err(|_| restore_invalid())?;
        match classify(entry.name()) {
            None => return Err(restore_invalid()),
            Some(Entry::Db) => has_db = true,
            Some(_) => {}
        }
        if entry.enclosed_name().is_none() {
            return Err(restore_invalid());
        }
    }
    if !has_db {
        return Err(restore_invalid());
    }
    let att_dir = pending.join(state::ATTACHMENTS_DIR);
    fs::create_dir_all(&att_dir)?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|_| restore_invalid())?;
        let target = match classify(entry.name()) {
            Some(Entry::Db) => pending.join(state::DB_FILE),
            Some(Entry::Attachment(name)) => att_dir.join(name),
            Some(Entry::Manifest | Entry::AttachmentsDir) | None => continue,
        };
        let mut out = File::create(&target)?;
        io::copy(&mut entry, &mut out).map_err(|_| restore_invalid())?;
    }
    let sha = sha256_file(&pending.join(state::DB_FILE))?;
    if !sha.eq_ignore_ascii_case(&manifest.db_sha256) {
        return Err(restore_invalid());
    }
    Ok(())
}

fn read_manifest<R: Read + Seek>(zip: &mut ZipArchive<R>) -> AppResult<Manifest> {
    let mut entry = zip.by_name(MANIFEST).map_err(|_| restore_invalid())?;
    let mut text = String::new();
    entry
        .read_to_string(&mut text)
        .map_err(|_| restore_invalid())?;
    serde_json::from_str(&text).map_err(|_| restore_invalid())
}

/// `PRAGMA integrity_check` = ok và phiên bản schema của DB giải nén ≤ bản app.
async fn check_integrity(db_file: &Path) -> AppResult<()> {
    let mut conn = SqliteConnectOptions::new()
        .filename(db_file)
        .connect()
        .await
        .map_err(|_| restore_invalid())?;
    let check: Result<String, sqlx::Error> = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_one(&mut conn)
        .await;
    let version: Result<Option<i64>, sqlx::Error> =
        sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations WHERE success = 1")
            .fetch_one(&mut conn)
            .await;
    let _ = conn.close().await;
    match (check.as_deref(), version) {
        (Ok("ok"), Ok(Some(v))) if v <= SCHEMA_VERSION => Ok(()),
        (Ok("ok"), Ok(Some(_))) => Err(restore_newer()),
        _ => Err(restore_invalid()),
    }
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let mut hex = String::with_capacity(64);
    for b in hasher.finalize().iter() {
        hex.push(char::from_digit(u32::from(b >> 4), 16).unwrap_or('0'));
        hex.push(char::from_digit(u32::from(b & 0xF), 16).unwrap_or('0'));
    }
    Ok(hex)
}

fn restore_invalid() -> AppError {
    AppError::new(
        ErrorCode::RestoreInvalid,
        "Tệp không phải bản sao lưu của Quản lý Task.",
    )
}

fn restore_newer() -> AppError {
    AppError::new(
        ErrorCode::RestoreNewerSchema,
        "Bản sao lưu được tạo bởi bản Quản lý Task mới hơn. Vui lòng cài bản mới hơn.",
    )
}

/// `path` + `suffix` (ví dụ `quanlytask.db` → `quanlytask.db-wal`).
fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut s: OsString = path.as_os_str().to_owned();
    s.push(suffix);
    PathBuf::from(s)
}

fn remove_if_exists(path: &Path) -> io::Result<()> {
    match fs::remove_file(path) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => Err(e),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_version_matches_latest_migration() {
        assert_eq!(
            db::MIGRATOR.iter().map(|m| m.version).max(),
            Some(SCHEMA_VERSION)
        );
    }

    #[test]
    fn classify_blocks_zip_slip() {
        assert!(matches!(classify("manifest.json"), Some(Entry::Manifest)));
        assert!(matches!(classify("quanlytask.db"), Some(Entry::Db)));
        assert!(matches!(
            classify("attachments/a.pdf"),
            Some(Entry::Attachment("a.pdf"))
        ));
        assert!(classify("attachments/../quanlytask.db").is_none());
        assert!(classify("../x").is_none());
        assert!(classify("C:/Windows/x").is_none());
        assert!(classify("attachments/sub/a.pdf").is_none());
    }
}
