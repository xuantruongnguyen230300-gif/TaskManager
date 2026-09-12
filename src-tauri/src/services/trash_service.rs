//! Thùng rác (R-07, docs/03 Q5). Chủ: B2.
//! Xoá vĩnh viễn: lấy `stored_path` trước, DELETE (CASCADE) + commit, rồi xoá file (lỗi chỉ ghi log).

use sqlx::SqlitePool;

use crate::db;
use crate::domain::dates::{self, TRASH_RETENTION_MS};
use crate::dto::{HistoryField, Id, TrashRow};
use crate::error::AppResult;
use crate::repo;
use crate::services::attachment_service;
use crate::services::history::{self, Change};
use crate::services::task_service::task_not_found;
use crate::state::AppState;

/// Dọn việc quá 30 ngày trước, rồi trả danh sách (mới xoá trước).
pub async fn list_trash(state: &AppState) -> AppResult<Vec<TrashRow>> {
    if let Err(e) = purge_expired(state).await {
        tracing::warn!(code = ?e.code, "không dọn được Thùng rác");
    }
    let mut conn = state.pool.acquire().await?;
    repo::tasks::list_trash(&mut conn, dates::now_ms()).await
}

/// Bỏ `deleted_at`, lịch sử "restored". Việc giữ nguyên trạng thái và mã.
pub async fn restore_task(pool: &SqlitePool, id: Id) -> AppResult<()> {
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    if repo::tasks::restore(&mut tx, id, now).await? == 0 {
        return Err(task_not_found());
    }
    let change = Change::new(HistoryField::Restored, None, None);
    history::record(&mut tx, id, now, &[change]).await?;
    tx.commit().await?;
    Ok(())
}

pub async fn purge_task(state: &AppState, id: Id) -> AppResult<()> {
    if purge(state, Some(id), None).await? == 0 {
        return Err(task_not_found());
    }
    Ok(())
}

pub async fn empty_trash(state: &AppState) -> AppResult<()> {
    purge(state, None, None).await?;
    Ok(())
}

/// Xoá vĩnh viễn việc đã ở Thùng rác quá 30 ngày. Gọi lúc khởi động và trong `list_trash`.
/// Trả số việc đã xoá.
pub async fn purge_expired(state: &AppState) -> AppResult<u64> {
    let n = purge(state, None, Some(dates::now_ms() - TRASH_RETENTION_MS)).await?;
    if n > 0 {
        tracing::info!(count = n, "đã tự xoá việc quá 30 ngày trong Thùng rác");
    }
    Ok(n)
}

async fn purge(state: &AppState, id: Option<Id>, before: Option<i64>) -> AppResult<u64> {
    let mut tx = db::begin_write(&state.pool).await?;
    let paths = repo::tasks::trash_stored_paths(&mut tx, id, before).await?;
    let n = repo::tasks::purge(&mut tx, id, before).await?;
    tx.commit().await?;
    attachment_service::remove_stored(&state.attachments_dir(), &paths);
    Ok(n)
}
