//! B1: dự án — R-02, quy tắc mã dự án, tiến độ.

#[path = "b1_common.rs"]
mod common;

use common::{insert_task, T};
use quan_ly_task_lib::db;
use quan_ly_task_lib::dto::{CreateProjectInput, Id, UpdateProjectInput};
use quan_ly_task_lib::services::project_service as svc;
use quan_ly_task_lib::ErrorCode;
use sqlx::SqlitePool;

async fn create(pool: &SqlitePool, code: &str) -> Id {
    svc::create_project(
        pool,
        CreateProjectInput {
            name: format!("Dự án {code}"),
            code: code.to_string(),
            color: "#5b8def".to_string(),
        },
    )
    .await
    .unwrap()
    .id
}

async fn next_no(pool: &SqlitePool, id: Id) -> i64 {
    sqlx::query_scalar("SELECT next_task_no FROM projects WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
        .unwrap()
}

fn update_input(id: Id, code: &str, name: &str) -> UpdateProjectInput {
    UpdateProjectInput {
        id,
        name: name.to_string(),
        code: code.to_string(),
        color: "#4DBB7F".to_string(),
    }
}

#[tokio::test]
async fn r02_delete_blocked_while_tasks_exist_including_trash() {
    let pool = db::open_memory().await.unwrap();
    let pid = create(&pool, "WEB").await;
    let tid = insert_task(
        &pool,
        T {
            deleted_at: Some(5),
            ..T::new("WEB-1", pid, "new")
        },
    )
    .await;
    let err = svc::delete_project(&pool, pid).await.unwrap_err();
    assert_eq!(err.code, ErrorCode::ProjectNotEmpty);
    assert_eq!(
        err.message,
        "Chỉ xoá được dự án không còn việc nào (kể cả trong Thùng rác)."
    );
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(tid)
        .execute(&pool)
        .await
        .unwrap();
    svc::delete_project(&pool, pid).await.unwrap();
    let list = svc::list_projects(&pool).await.unwrap();
    assert!(list.iter().all(|p| p.id != pid));
}

#[tokio::test]
async fn r02_default_project_cannot_be_deleted() {
    let pool = db::open_memory().await.unwrap();
    let err = svc::delete_project(&pool, 1).await.unwrap_err();
    assert_eq!(err.code, ErrorCode::ProjectProtected);
    assert_eq!(err.message, "Không thể xoá dự án Việc chung.");
    let err = svc::delete_project(&pool, 999).await.unwrap_err();
    assert_eq!(err.code, ErrorCode::NotFound);
}

#[tokio::test]
async fn project_code_format_and_duplicate() {
    let pool = db::open_memory().await.unwrap();
    let p = svc::create_project(
        &pool,
        CreateProjectInput {
            name: " Website ".into(),
            code: " web ".into(),
            color: "#5b8def".into(),
        },
    )
    .await
    .unwrap();
    assert_eq!(p.code, "WEB");
    assert_eq!(p.name, "Website");
    assert_eq!(p.color, "#5B8DEF");

    for bad in ["1AB", "A", "ABCDEFG", "AB-C"] {
        let err = svc::create_project(
            &pool,
            CreateProjectInput {
                name: "X".into(),
                code: bad.into(),
                color: "#5B8DEF".into(),
            },
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::Validation, "{bad}");
        assert_eq!(err.field.as_deref(), Some("code"));
    }

    let dup = svc::create_project(
        &pool,
        CreateProjectInput {
            name: "Khác".into(),
            code: "Web".into(),
            color: "#5B8DEF".into(),
        },
    )
    .await
    .unwrap_err();
    assert_eq!(dup.code, ErrorCode::DuplicateCode);
    assert_eq!(dup.message, "Mã “WEB” đã được dùng cho dự án khác.");
    assert_eq!(dup.field.as_deref(), Some("code"));

    let app = create(&pool, "APP").await;
    let err = svc::update_project(&pool, update_input(app, "WEB", "App"))
        .await
        .unwrap_err();
    assert_eq!(err.code, ErrorCode::DuplicateCode);
    let err = svc::update_project(&pool, update_input(app, "VC", "App"))
        .await
        .unwrap_err();
    assert_eq!(err.code, ErrorCode::DuplicateCode);
}

#[tokio::test]
async fn project_code_locked_once_project_has_tasks_even_in_trash() {
    let pool = db::open_memory().await.unwrap();
    let pid = create(&pool, "WEB").await;
    insert_task(
        &pool,
        T {
            deleted_at: Some(5),
            ..T::new("WEB-1", pid, "done")
        },
    )
    .await;
    let err = svc::update_project(&pool, update_input(pid, "SITE", "Website"))
        .await
        .unwrap_err();
    assert_eq!(err.code, ErrorCode::Validation);
    assert_eq!(err.field.as_deref(), Some("code"));
    assert_eq!(err.message, "Không đổi được mã vì dự án đã có việc.");
    // Giữ nguyên mã (kể cả khác hoa thường) thì sửa tên/màu được.
    let p = svc::update_project(&pool, update_input(pid, "web", "Website mới"))
        .await
        .unwrap();
    assert_eq!(p.code, "WEB");
    assert_eq!(p.name, "Website mới");
    assert_eq!(p.color, "#4DBB7F");
    assert!(p.has_tasks);
}

#[tokio::test]
async fn project_code_change_without_tasks_and_next_no_skips_old_codes() {
    let pool = db::open_memory().await.unwrap();
    // Việc NEW-5 đã chuyển sang Việc chung, vẫn giữ mã (R-01).
    insert_task(&pool, T::new("NEW-5", 1, "new")).await;
    let pid = create(&pool, "OLD").await;
    assert_eq!(next_no(&pool, pid).await, 1);
    let p = svc::update_project(&pool, update_input(pid, "NEW", "Mới"))
        .await
        .unwrap();
    assert_eq!(p.code, "NEW");
    assert_eq!(next_no(&pool, pid).await, 6);
    // Tạo dự án mới lấy mã có việc cũ: không sinh trùng mã.
    insert_task(&pool, T::new("NB-12", 1, "new")).await;
    let nb = create(&pool, "NB").await;
    assert_eq!(next_no(&pool, nb).await, 13);
    // Mã "NE" chỉ khớp "NE-…", không khớp "NEW-5".
    let n2 = create(&pool, "NE").await;
    assert_eq!(next_no(&pool, n2).await, 1);
}

#[tokio::test]
async fn project_progress_excludes_trash_and_cancelled() {
    let pool = db::open_memory().await.unwrap();
    let pid = create(&pool, "WEB").await;
    let empty = create(&pool, "APP").await;
    for (code, status, deleted) in [
        ("WEB-1", "done", None),
        ("WEB-2", "done", Some(9)),
        ("WEB-3", "new", None),
        ("WEB-4", "cancelled", None),
        ("WEB-5", "in_progress", None),
        ("WEB-6", "waiting", Some(9)),
    ] {
        insert_task(
            &pool,
            T {
                deleted_at: deleted,
                ..T::new(code, pid, status)
            },
        )
        .await;
    }
    let list = svc::list_projects(&pool).await.unwrap();
    assert_eq!(
        list.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![1, pid, empty]
    );
    let vc = &list[0];
    assert!(vc.is_default);
    assert!(!vc.has_tasks);
    let web = list.iter().find(|p| p.id == pid).unwrap();
    assert_eq!(web.done_count, 1);
    assert_eq!(web.progress_total, 3);
    assert!(web.has_tasks);
    assert!(!web.is_default);
    let app = list.iter().find(|p| p.id == empty).unwrap();
    assert_eq!((app.done_count, app.progress_total), (0, 0));
    assert!(!app.has_tasks);
}
