//! Tệp đính kèm (R-09, docs/05 §6). Chủ: B2.
//! Chép vào `attachments/<uuid>.<đuôi>`; lỗi DB thì xoá file vừa chép; gỡ: xoá dòng trước, file sau commit.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use sqlx::{SqliteConnection, SqlitePool};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use crate::db;
use crate::domain::{dates, validate};
use crate::dto::{AddAttachmentsInput, Attachment, HistoryField, Id, PickedFile};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::repo;
use crate::services::history::{self, Change};
use crate::services::task_service::task_not_found;
use crate::state::AppState;

/// Tiền tố của `stored_path` (docs/03: `attachments/<uuid>.<ext>`).
const STORED_PREFIX: &str = "attachments/";
/// `task_attachments.file_name` tối đa 255 ký tự.
const MAX_FILE_NAME: usize = 255;

/// Tệp nguồn đã kiểm tra: tồn tại, là file, ≤ 50 MB.
#[derive(Debug, Clone)]
pub struct SourceFile {
    pub path: PathBuf,
    pub file_name: String,
    pub size_bytes: i64,
}

/// Tệp đã chép vào `attachments/` (chưa có dòng DB).
#[derive(Debug, Clone)]
pub struct CopiedFile {
    pub file_name: String,
    pub stored_path: String,
    pub abs_path: PathBuf,
    pub size_bytes: i64,
}

/// Hộp thoại chọn nhiều tệp (tauri-plugin-dialog, gọi từ Rust). Huỷ → `vec![]`.
pub async fn pick_files(app: &AppHandle) -> AppResult<Vec<PickedFile>> {
    let handle = app.clone();
    let picked =
        tauri::async_runtime::spawn_blocking(move || handle.dialog().file().blocking_pick_files())
            .await?;
    let files = picked
        .unwrap_or_default()
        .iter()
        .filter_map(|p| p.as_path())
        .filter_map(|path| {
            let meta = fs::metadata(path).ok().filter(|m| m.is_file())?;
            Some(PickedFile {
                path: path.to_string_lossy().into_owned(),
                file_name: display_name(path),
                size_bytes: size_i64(meta.len()),
            })
        })
        .collect();
    Ok(files)
}

pub async fn add_attachments(
    state: &AppState,
    input: AddAttachmentsInput,
) -> AppResult<Vec<Attachment>> {
    let files = inspect_files(&input.file_paths)?;
    if files.is_empty() {
        return Ok(Vec::new());
    }
    let copied = copy_files(state.attachments_dir(), files).await?;
    let result = insert_for_task(&state.pool, input.task_id, &copied).await;
    if result.is_err() {
        discard(&copied);
    }
    result
}

async fn insert_for_task(
    pool: &SqlitePool,
    task_id: Id,
    copied: &[CopiedFile],
) -> AppResult<Vec<Attachment>> {
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    if !repo::tasks::exists_active(&mut tx, task_id).await? {
        return Err(task_not_found());
    }
    let added = insert_rows(&mut tx, task_id, copied, now).await?;
    history::record(&mut tx, task_id, now, &added_changes(copied)).await?;
    repo::tasks::touch(&mut tx, task_id, now).await?;
    tx.commit().await?;
    Ok(added)
}

pub async fn remove_attachment(state: &AppState, id: Id) -> AppResult<()> {
    let now = dates::now_ms();
    let mut tx = db::begin_write(&state.pool).await?;
    let att = repo::attachments::get_stored(&mut tx, id)
        .await?
        .ok_or_else(attachment_not_found)?;
    repo::attachments::delete(&mut tx, id).await?;
    let change = Change::new(
        HistoryField::AttachmentRemoved,
        Some(att.file_name.clone()),
        None,
    );
    history::record(&mut tx, att.task_id, now, &[change]).await?;
    repo::tasks::touch(&mut tx, att.task_id, now).await?;
    tx.commit().await?;
    remove_stored(&state.attachments_dir(), &[att.stored_path]);
    Ok(())
}

/// Kiểm tra `stored_path` nằm trong `attachments/`, rồi mở bằng tauri-plugin-opener.
/// Không thấy file → FILE_MISSING "Không tìm thấy tệp “{tên}” trong thư mục dữ liệu."
pub async fn open_attachment(app: &AppHandle, state: &AppState, id: Id) -> AppResult<()> {
    let att = {
        let mut conn = state.pool.acquire().await?;
        repo::attachments::get_stored(&mut conn, id)
            .await?
            .ok_or_else(attachment_not_found)?
    };
    let path = resolve_stored(&state.attachments_dir(), &att.stored_path).ok_or_else(|| {
        AppError::new(
            ErrorCode::FileMissing,
            format!(
                "Không tìm thấy tệp “{}” trong thư mục dữ liệu.",
                att.file_name
            ),
        )
    })?;
    app.opener()
        .open_path(path.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|e| {
            tracing::warn!(id, error = %e, "không mở được tệp đính kèm");
            AppError::new(ErrorCode::Io, "Không mở được tệp.")
        })
}

// ---------- Dùng chung với task_service / trash_service / data_service ----------

/// Kiểm tra các đường dẫn nguồn (R-09: mỗi tệp ≤ 50 MB).
pub fn inspect_files(paths: &[String]) -> AppResult<Vec<SourceFile>> {
    paths
        .iter()
        .map(|p| {
            let path = PathBuf::from(p);
            let file_name = display_name(&path);
            let meta = fs::metadata(&path)
                .ok()
                .filter(|m| m.is_file())
                .ok_or_else(|| {
                    AppError::new(
                        ErrorCode::FileMissing,
                        format!("Không tìm thấy tệp “{file_name}”."),
                    )
                })?;
            let size_bytes = size_i64(meta.len());
            validate::attachment_size(&file_name, size_bytes)?;
            Ok(SourceFile {
                path,
                file_name,
                size_bytes,
            })
        })
        .collect()
}

/// Chép tệp vào `dir` với tên uuid. Lỗi giữa chừng thì xoá các tệp đã chép.
pub async fn copy_files(dir: PathBuf, files: Vec<SourceFile>) -> AppResult<Vec<CopiedFile>> {
    if files.is_empty() {
        return Ok(Vec::new());
    }
    run_blocking(move || {
        fs::create_dir_all(&dir)?;
        let mut done = Vec::with_capacity(files.len());
        for f in &files {
            match copy_one(&dir, f) {
                Ok(c) => done.push(c),
                Err(e) => {
                    discard(&done);
                    return Err(e);
                }
            }
        }
        Ok(done)
    })
    .await
}

fn copy_one(dir: &Path, f: &SourceFile) -> AppResult<CopiedFile> {
    let ext = f
        .path
        .extension()
        .and_then(|e| e.to_str())
        .filter(|e| !e.is_empty() && e.len() <= 16 && e.chars().all(|c| c.is_ascii_alphanumeric()))
        .map(str::to_ascii_lowercase);
    let id = uuid::Uuid::new_v4().simple().to_string();
    let name = match ext {
        Some(e) => format!("{id}.{e}"),
        None => id,
    };
    let abs_path = dir.join(&name);
    let size_bytes = size_i64(fs::copy(&f.path, &abs_path)?);
    if let Err(e) = validate::attachment_size(&f.file_name, size_bytes) {
        let _ = fs::remove_file(&abs_path);
        return Err(e);
    }
    Ok(CopiedFile {
        file_name: f.file_name.clone(),
        stored_path: format!("{STORED_PREFIX}{name}"),
        abs_path,
        size_bytes,
    })
}

/// Chèn dòng `task_attachments` cho các tệp đã chép (trong transaction của người gọi).
pub async fn insert_rows(
    conn: &mut SqliteConnection,
    task_id: Id,
    files: &[CopiedFile],
    now: i64,
) -> AppResult<Vec<Attachment>> {
    let mut out = Vec::with_capacity(files.len());
    for f in files {
        out.push(
            repo::attachments::insert(
                conn,
                task_id,
                &f.file_name,
                &f.stored_path,
                f.size_bytes,
                now,
            )
            .await?,
        );
    }
    Ok(out)
}

/// Dòng lịch sử "Thêm tệp: {tên}" cho mỗi tệp.
pub fn added_changes(files: &[CopiedFile]) -> Vec<Change> {
    files
        .iter()
        .map(|f| {
            Change::new(
                HistoryField::AttachmentAdded,
                None,
                Some(f.file_name.clone()),
            )
        })
        .collect()
}

/// Xoá các tệp vừa chép khi ghi DB lỗi.
pub fn discard(files: &[CopiedFile]) {
    for f in files {
        if let Err(e) = fs::remove_file(&f.abs_path) {
            tracing::warn!(kind = ?e.kind(), "không xoá được tệp vừa chép");
        }
    }
}

/// Xoá file vật lý sau khi đã commit (lỗi chỉ ghi log).
pub fn remove_stored(dir: &Path, stored_paths: &[String]) {
    for sp in stored_paths {
        let Some(name) = stored_file_name(sp) else {
            continue;
        };
        match fs::remove_file(dir.join(name)) {
            Err(e) if e.kind() != io::ErrorKind::NotFound => {
                tracing::warn!(kind = ?e.kind(), "không xoá được tệp đính kèm");
            }
            _ => {}
        }
    }
}

/// Tên tệp trong `attachments/` từ `stored_path` (chặn `..`, dấu phân cách, ổ đĩa).
pub fn stored_file_name(stored_path: &str) -> Option<&str> {
    stored_path
        .strip_prefix(STORED_PREFIX)
        .filter(|n| is_plain_name(n))
}

/// Tên tệp đơn (không thư mục con, không `..`).
pub fn is_plain_name(n: &str) -> bool {
    !n.is_empty() && n != "." && n != ".." && !n.contains(['/', '\\', ':'])
}

/// Đường dẫn tuyệt đối của tệp đã lưu, CHỈ khi nằm trong `dir` và đang tồn tại.
pub fn resolve_stored(dir: &Path, stored_path: &str) -> Option<PathBuf> {
    let path = dir.join(stored_file_name(stored_path)?);
    let canon = path.canonicalize().ok()?;
    let root = dir.canonicalize().ok()?;
    (canon.starts_with(&root) && canon.is_file()).then_some(path)
}

/// Chạy việc IO nặng ngoài luồng async.
pub async fn run_blocking<T, F>(f: F) -> AppResult<T>
where
    F: FnOnce() -> AppResult<T> + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|_| AppError::internal("Lỗi hệ thống."))?
}

fn attachment_not_found() -> AppError {
    AppError::not_found("Không tìm thấy tệp đính kèm.")
}

fn display_name(path: &Path) -> String {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "tệp".to_string());
    if name.chars().count() > MAX_FILE_NAME {
        name.chars().take(MAX_FILE_NAME).collect()
    } else {
        name
    }
}

fn size_i64(n: u64) -> i64 {
    i64::try_from(n).unwrap_or(i64::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stored_name_rejects_traversal() {
        assert_eq!(stored_file_name("attachments/ab.pdf"), Some("ab.pdf"));
        assert_eq!(stored_file_name("attachments/../x.db"), None);
        assert_eq!(stored_file_name("attachments/a/b.pdf"), None);
        assert_eq!(stored_file_name("attachments/.."), None);
        assert_eq!(stored_file_name("other/ab.pdf"), None);
        assert_eq!(stored_file_name("attachments/C:x"), None);
    }
}
