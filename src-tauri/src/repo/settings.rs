//! Bảng `settings` (key/value). Chủ: B1.

use sqlx::SqliteConnection;

use crate::error::AppResult;

pub async fn get(conn: &mut SqliteConnection, key: &str) -> AppResult<Option<String>> {
    Ok(
        sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_optional(conn)
            .await?,
    )
}

pub async fn set(conn: &mut SqliteConnection, key: &str, value: &str) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(conn)
    .await?;
    Ok(())
}
