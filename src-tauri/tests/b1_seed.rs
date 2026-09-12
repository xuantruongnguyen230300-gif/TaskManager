//! B1: dữ liệu mẫu (chỉ bản debug).
#![cfg(debug_assertions)]

use quan_ly_task_lib::db;
use quan_ly_task_lib::services::dev_seed;

#[tokio::test]
async fn seed_is_consistent_and_runs_once() {
    let pool = db::open_memory().await.unwrap();
    dev_seed::seed_sample_data(&pool).await.unwrap();

    let (emps, inactive, tasks, created_rows): (i64, i64, i64, i64) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM employees),
                (SELECT COUNT(*) FROM employees WHERE status = 'inactive'),
                (SELECT COUNT(*) FROM tasks),
                (SELECT COUNT(*) FROM task_history WHERE field = 'created')",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!((emps, inactive, tasks, created_rows), (7, 1, 19, 19));
    let me: String = sqlx::query_scalar("SELECT full_name FROM employees WHERE is_self = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(me, "Trần Minh Quân");

    // next_task_no > mọi số đã dùng của mã dự án.
    let bad: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks t JOIN projects p ON t.code GLOB p.code || '-[0-9]*'
         WHERE CAST(substr(t.code, length(p.code) + 2) AS INTEGER) >= p.next_task_no",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(bad, 0);
    let statuses: i64 = sqlx::query_scalar("SELECT COUNT(DISTINCT status) FROM tasks")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(statuses, 5);

    assert!(dev_seed::seed_sample_data(&pool).await.is_err());
}
