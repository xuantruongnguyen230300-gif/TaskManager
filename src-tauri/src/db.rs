//! Mở pool SQLite (PRAGMA theo docs/03 §2), sao lưu trước migrate, chạy migration nhúng.

use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

use sqlx::migrate::Migrator;
use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteSynchronous,
};
use sqlx::{Sqlite, Transaction};

use crate::error::AppResult;
use crate::state;

pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Số bản `pre-migrate-*.db` giữ lại.
const KEEP_PRE_MIGRATE: usize = 5;

fn connect_options(opts: SqliteConnectOptions) -> SqliteConnectOptions {
    opts.journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_millis(5000))
}

/// Mở DB trong thư mục dữ liệu, sao lưu nếu có migration mới, rồi migrate.
pub async fn open_and_migrate(data_dir: &Path) -> AppResult<SqlitePool> {
    let path = state::db_path(data_dir);
    let existed = path.exists();
    let opts = connect_options(
        SqliteConnectOptions::new()
            .filename(&path)
            .create_if_missing(true),
    );
    let pool = SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(opts)
        .await?;
    if existed {
        backup_before_migrate(&pool, data_dir).await?;
    }
    MIGRATOR.run(&pool).await?;
    Ok(pool)
}

/// DB trong bộ nhớ đã chạy migration — dùng cho test services.
/// Một connection duy nhất, không bao giờ đóng (mỗi connection `:memory:` là một DB riêng).
pub async fn open_memory() -> AppResult<SqlitePool> {
    let opts = connect_options(SqliteConnectOptions::from_str("sqlite::memory:")?)
        .journal_mode(SqliteJournalMode::Memory);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .idle_timeout(None)
        .max_lifetime(None)
        .connect_with(opts)
        .await?;
    MIGRATOR.run(&pool).await?;
    Ok(pool)
}

/// Transaction ghi: `BEGIN IMMEDIATE` (docs/03 §2). Mọi thao tác ghi của service dùng hàm này.
pub async fn begin_write(pool: &SqlitePool) -> AppResult<Transaction<'static, Sqlite>> {
    Ok(pool.begin_with("BEGIN IMMEDIATE").await?)
}

/// Nếu DB đã có dữ liệu và còn migration chưa chạy: `VACUUM INTO backups/pre-migrate-...db`.
async fn backup_before_migrate(pool: &SqlitePool, data_dir: &Path) -> AppResult<()> {
    let has_table: Option<(String,)> = sqlx::query_as(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations'",
    )
    .fetch_optional(pool)
    .await?;
    if has_table.is_none() {
        return Ok(());
    }
    let applied: Vec<(i64,)> =
        sqlx::query_as("SELECT version FROM _sqlx_migrations WHERE success = 1")
            .fetch_all(pool)
            .await?;
    let current = applied.iter().map(|(v,)| *v).max().unwrap_or(0);
    let latest = MIGRATOR.iter().map(|m| m.version).max().unwrap_or(0);
    if applied.is_empty() || current >= latest {
        return Ok(());
    }
    let dir = state::backups_dir(data_dir);
    std::fs::create_dir_all(&dir)?;
    let ts = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let file = dir.join(format!("pre-migrate-v{current}-to-v{latest}-{ts}.db"));
    let file_str = file.to_string_lossy().to_string();
    sqlx::query("VACUUM INTO ?")
        .bind(file_str)
        .execute(pool)
        .await?;
    tracing::info!(current, latest, "đã sao lưu trước migrate");
    prune_backups(&dir, "pre-migrate-", KEEP_PRE_MIGRATE);
    Ok(())
}

/// Giữ `keep` file mới nhất có tiền tố `prefix` trong `dir` (tên chứa thời điểm nên sắp theo tên).
pub fn prune_backups(dir: &Path, prefix: &str, keep: usize) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<_> = entries
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(prefix))
        })
        .collect();
    files.sort();
    let excess = files.len().saturating_sub(keep);
    for old in files.into_iter().take(excess) {
        if let Err(e) = std::fs::remove_file(&old) {
            tracing::warn!(error = %e, "không xoá được bản sao lưu cũ");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn migration_seeds_self_and_default_project() {
        let pool = open_memory().await.unwrap();
        let (name,): (String,) =
            sqlx::query_as("SELECT full_name FROM employees WHERE is_self = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(name, "Tôi");
        let (code,): (String,) = sqlx::query_as("SELECT code FROM projects WHERE id = 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(code, "VC");
        let (fk,): (i64,) = sqlx::query_as("PRAGMA foreign_keys")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(fk, 1);
    }
}
