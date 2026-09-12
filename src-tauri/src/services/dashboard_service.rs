//! SC-1 Tổng quan (docs/02 §8, docs/03 Q1). Chủ: B2.

use sqlx::SqlitePool;

use crate::domain::dates::Clock;
use crate::dto::Dashboard;
use crate::error::AppResult;
use crate::repo;

/// 4 số + "Cần chú ý" + "Theo nhân viên" trong một transaction đọc. Tham số ngày lấy từ `domain::dates::Clock`.
pub async fn get_dashboard(pool: &SqlitePool) -> AppResult<Dashboard> {
    let clock = Clock::now();
    let mut tx = pool.begin().await?;
    let counts = repo::tasks::dashboard_counts(
        &mut tx,
        &clock.today,
        clock.week_start_ms,
        clock.next_week_start_ms,
    )
    .await?;
    let attention = repo::tasks::attention_rows(&mut tx, &clock.tomorrow).await?;
    let by_employee = repo::tasks::workloads(&mut tx, &clock.today).await?;
    tx.commit().await?;
    Ok(Dashboard {
        open_count: counts.open_count,
        overdue_count: counts.overdue_count,
        waiting_count: counts.waiting_count,
        done_this_week_count: counts.done_this_week_count,
        attention,
        by_employee,
    })
}
