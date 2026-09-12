//! Test tích hợp B2: sao lưu → khôi phục ra dữ liệu giống hệt (R-10).

use std::path::{Path, PathBuf};

use quan_ly_task_lib::dto::{AddCommentInput, CreateTaskInput, SetTaskStatusInput, TaskStatus};
use quan_ly_task_lib::services::{data_service, task_service};
use quan_ly_task_lib::{db, state, AppState, ErrorCode};
use sqlx::SqlitePool;

fn temp_dir() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("qlt-b2d-{}", uuid::Uuid::new_v4().simple()));
    std::fs::create_dir_all(state::attachments_dir(&dir)).unwrap();
    dir
}

fn task(title: &str, files: Vec<String>) -> CreateTaskInput {
    CreateTaskInput {
        project_id: 1,
        title: title.to_string(),
        description: Some("Mô tả\nnhiều dòng".into()),
        assignee_id: None,
        creator_id: 1,
        status: TaskStatus::New,
        status_note: None,
        priority: 3,
        start_date: Some("2026-09-01".into()),
        due_date: Some("2026-09-30".into()),
        subtasks: vec!["Con 1".into(), "Con 2".into()],
        file_paths: files,
    }
}

/// Toàn bộ dữ liệu dạng chữ để so sánh.
async fn snapshot(pool: &SqlitePool) -> String {
    let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM tasks ORDER BY id")
        .fetch_all(pool)
        .await
        .unwrap();
    let mut out = String::new();
    for id in ids {
        let d = task_service::get_task(pool, id).await.unwrap();
        out.push_str(&format!("{d:?}\n"));
    }
    let projects: Vec<(i64, String, String, String, i64)> =
        sqlx::query_as("SELECT id, code, name, color, next_task_no FROM projects ORDER BY id")
            .fetch_all(pool)
            .await
            .unwrap();
    let employees: Vec<(i64, String, String, i64)> =
        sqlx::query_as("SELECT id, full_name, status, is_self FROM employees ORDER BY id")
            .fetch_all(pool)
            .await
            .unwrap();
    out.push_str(&format!("{projects:?}\n{employees:?}"));
    out
}

async fn stored_paths(pool: &SqlitePool) -> Vec<String> {
    sqlx::query_scalar("SELECT stored_path FROM task_attachments ORDER BY id")
        .fetch_all(pool)
        .await
        .unwrap()
}

fn read_stored(dir: &Path, stored: &str) -> Vec<u8> {
    std::fs::read(state::attachments_dir(dir).join(stored.trim_start_matches("attachments/")))
        .unwrap()
}

#[tokio::test]
async fn r10_backup_then_restore_gives_identical_data() {
    // Dữ liệu nguồn.
    let src_dir = temp_dir();
    let src = AppState::new(
        db::open_and_migrate(&src_dir).await.unwrap(),
        src_dir.clone(),
    );
    let file = src_dir.join("hop-dong.docx");
    let content: Vec<u8> = (0..20_000u32).map(|i| (i % 251) as u8).collect();
    std::fs::write(&file, &content).unwrap();
    let t = task_service::create_task(&src, task("Hợp đồng", vec![file.to_string_lossy().into()]))
        .await
        .unwrap();
    task_service::add_comment(
        &src.pool,
        AddCommentInput {
            task_id: t.task.id,
            author_id: 1,
            body: "Đã gửi khách".into(),
        },
    )
    .await
    .unwrap();
    task_service::set_task_status(
        &src.pool,
        SetTaskStatusInput {
            id: t.task.id,
            status: TaskStatus::Waiting,
            note: Some("Chờ ký".into()),
        },
    )
    .await
    .unwrap();
    task_service::create_task(&src, task("Việc 2", vec![]))
        .await
        .unwrap();
    let zip = src_dir.join("QuanLyTask-test.zip");
    data_service::create_backup(&src.pool, &src_dir, &zip)
        .await
        .unwrap();
    let before = snapshot(&src.pool).await;
    let src_stored = stored_paths(&src.pool).await;

    // Thư mục đích đang có dữ liệu khác.
    let dst_dir = temp_dir();
    let dst = AppState::new(
        db::open_and_migrate(&dst_dir).await.unwrap(),
        dst_dir.clone(),
    );
    task_service::create_task(&dst, task("Sẽ bị thay", vec![]))
        .await
        .unwrap();

    // Tệp không hợp lệ bị từ chối, dữ liệu hiện tại không đổi.
    let bad = dst_dir.join("bad.zip");
    std::fs::write(&bad, b"khong phai zip").unwrap();
    let err = data_service::prepare_restore(&dst.pool, &dst_dir, &bad)
        .await
        .unwrap_err();
    assert_eq!(err.code, ErrorCode::RestoreInvalid);
    assert!(!state::restore_pending_dir(&dst_dir).exists());

    data_service::prepare_restore(&dst.pool, &dst_dir, &zip)
        .await
        .unwrap();
    let auto = std::fs::read_dir(state::backups_dir(&dst_dir))
        .unwrap()
        .filter_map(Result::ok)
        .any(|e| {
            e.file_name()
                .to_string_lossy()
                .starts_with("auto-before-restore-")
        });
    assert!(auto, "phải tự sao lưu dữ liệu hiện tại trước khi khôi phục");
    dst.pool.close().await;

    // Khởi động lại: áp dụng bản chờ trước khi mở pool.
    data_service::apply_pending_restore(&dst_dir).unwrap();
    assert!(!state::restore_pending_dir(&dst_dir).exists());
    let restored = db::open_and_migrate(&dst_dir).await.unwrap();
    assert_eq!(snapshot(&restored).await, before);
    let dst_stored = stored_paths(&restored).await;
    assert_eq!(dst_stored, src_stored);
    assert_eq!(read_stored(&dst_dir, &dst_stored[0]), content);
    restored.close().await;
    src.pool.close().await;
    let _ = std::fs::remove_dir_all(&src_dir);
    let _ = std::fs::remove_dir_all(&dst_dir);
}
