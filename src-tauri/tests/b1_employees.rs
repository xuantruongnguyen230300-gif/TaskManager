//! B1: nhân viên — R-04, R-05, danh sách/chi tiết, cài đặt.

#[path = "b1_common.rs"]
mod common;

use std::path::PathBuf;

use common::{insert_task, T};
use quan_ly_task_lib::db;
use quan_ly_task_lib::domain::dates::{now_ms, Clock, DAY_MS};
use quan_ly_task_lib::dto::{
    CreateEmployeeInput, DeactivateEmployeeInput, EmployeeStatus, EmployeeStatusFilter, Id,
    ListEmployeesInput, Theme, UpdateEmployeeInput, UpdateSettingsInput,
};
use quan_ly_task_lib::services::{employee_service as svc, settings_service};
use quan_ly_task_lib::{AppState, ErrorCode};
use sqlx::SqlitePool;

async fn create(pool: &SqlitePool, name: &str) -> Id {
    svc::create_employee(
        pool,
        CreateEmployeeInput {
            full_name: name.to_string(),
            title: None,
            phone: None,
            email: None,
            color: "#2F80ED".to_string(),
        },
    )
    .await
    .unwrap()
    .id
}

async fn assignee_of(pool: &SqlitePool, task_id: Id) -> Option<Id> {
    sqlx::query_scalar("SELECT assignee_id FROM tasks WHERE id = ?")
        .bind(task_id)
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn history_of(
    pool: &SqlitePool,
    task_id: Id,
) -> Vec<(String, Option<String>, Option<String>)> {
    sqlx::query_as("SELECT field, old_value, new_value FROM task_history WHERE task_id = ?")
        .bind(task_id)
        .fetch_all(pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn r05_delete_blocked_when_employee_has_tasks_or_comments() {
    let pool = db::open_memory().await.unwrap();
    let assignee = create(&pool, "Lê Thu Hà").await;
    let creator = create(&pool, "Phạm Đức Anh").await;
    let author = create(&pool, "Nguyễn Ngọc Lan").await;
    let free = create(&pool, "Võ Hoàng Nam").await;
    // Việc trong Thùng rác vẫn tính.
    insert_task(
        &pool,
        T {
            assignee: Some(assignee),
            deleted_at: Some(1),
            ..T::new("VC-1", 1, "done")
        },
    )
    .await;
    let t2 = insert_task(
        &pool,
        T {
            creator,
            ..T::new("VC-2", 1, "new")
        },
    )
    .await;
    sqlx::query(
        "INSERT INTO task_comments (task_id, author_id, body, created_at, updated_at)
         VALUES (?, ?, 'Ý kiến', 1, 1)",
    )
    .bind(t2)
    .bind(author)
    .execute(&pool)
    .await
    .unwrap();

    for id in [assignee, creator, author] {
        let err = svc::delete_employee(&pool, id).await.unwrap_err();
        assert_eq!(err.code, ErrorCode::EmployeeInUse);
    }
    let err = svc::delete_employee(&pool, assignee).await.unwrap_err();
    assert_eq!(
        err.message,
        "Lê Thu Hà đã có việc hoặc bình luận nên không xoá được, chỉ có thể chuyển sang Đã nghỉ."
    );
    svc::delete_employee(&pool, free).await.unwrap();
    assert_eq!(
        svc::get_employee(&pool, free).await.unwrap_err().code,
        ErrorCode::NotFound
    );
}

#[tokio::test]
async fn r05_self_profile_cannot_be_deleted_or_deactivated() {
    let pool = db::open_memory().await.unwrap();
    let err = svc::delete_employee(&pool, 1).await.unwrap_err();
    assert_eq!(err.code, ErrorCode::SelfProtected);
    let err = svc::deactivate_employee(
        &pool,
        DeactivateEmployeeInput {
            id: 1,
            reassign_to: None,
        },
    )
    .await
    .unwrap_err();
    assert_eq!(err.code, ErrorCode::SelfProtected);
    // Hồ sơ "Tôi" vẫn sửa được.
    let me = svc::update_employee(
        &pool,
        UpdateEmployeeInput {
            id: 1,
            full_name: " Trần Minh Quân ".into(),
            title: Some("Trưởng nhóm".into()),
            phone: Some("  ".into()),
            email: None,
            color: "#6e56cf".into(),
        },
    )
    .await
    .unwrap();
    assert_eq!(me.full_name, "Trần Minh Quân");
    assert_eq!(me.phone, None);
    assert_eq!(me.color, "#6E56CF");
    assert!(me.is_self);
    assert_eq!(me.status, EmployeeStatus::Active);
}

#[tokio::test]
async fn r04_deactivate_reassigns_open_tasks_and_records_history() {
    let pool = db::open_memory().await.unwrap();
    let ha = create(&pool, "Lê Thu Hà").await;
    let anh = create(&pool, "Phạm Đức Anh").await;
    let mut open = Vec::new();
    for (i, st) in ["new", "in_progress", "waiting"].into_iter().enumerate() {
        let code = format!("VC-{}", i + 1);
        open.push(
            insert_task(
                &pool,
                T {
                    assignee: Some(ha),
                    ..T::new(&code, 1, st)
                },
            )
            .await,
        );
    }
    let done = insert_task(
        &pool,
        T {
            assignee: Some(ha),
            ..T::new("VC-4", 1, "done")
        },
    )
    .await;
    let trashed = insert_task(
        &pool,
        T {
            assignee: Some(ha),
            deleted_at: Some(1),
            ..T::new("VC-5", 1, "new")
        },
    )
    .await;

    let res = svc::deactivate_employee(
        &pool,
        DeactivateEmployeeInput {
            id: ha,
            reassign_to: Some(anh),
        },
    )
    .await
    .unwrap();
    assert_eq!(res.reassigned_count, 3);
    for id in &open {
        assert_eq!(assignee_of(&pool, *id).await, Some(anh));
        assert_eq!(
            history_of(&pool, *id).await,
            vec![(
                "assignee".to_string(),
                Some("Lê Thu Hà".to_string()),
                Some("Phạm Đức Anh".to_string())
            )]
        );
    }
    assert_eq!(assignee_of(&pool, done).await, Some(ha));
    assert_eq!(assignee_of(&pool, trashed).await, Some(ha));
    assert!(history_of(&pool, done).await.is_empty());

    let ha_detail = svc::get_employee(&pool, ha).await.unwrap();
    assert_eq!(ha_detail.status, EmployeeStatus::Inactive);
    assert_eq!(ha_detail.open_count, 0);
    assert_eq!(svc::get_employee(&pool, anh).await.unwrap().open_count, 3);

    // "Làm việc lại"
    svc::reactivate_employee(&pool, ha).await.unwrap();
    assert_eq!(
        svc::get_employee(&pool, ha).await.unwrap().status,
        EmployeeStatus::Active
    );
}

#[tokio::test]
async fn r04_deactivate_to_unassigned_and_target_must_be_active() {
    let pool = db::open_memory().await.unwrap();
    let ha = create(&pool, "Lê Thu Hà").await;
    let viet = create(&pool, "Bùi Quốc Việt").await;
    let t = insert_task(
        &pool,
        T {
            assignee: Some(ha),
            ..T::new("VC-1", 1, "new")
        },
    )
    .await;
    svc::deactivate_employee(
        &pool,
        DeactivateEmployeeInput {
            id: viet,
            reassign_to: None,
        },
    )
    .await
    .unwrap();

    // Người nhận đã nghỉ hoặc chính người đó → lỗi, không đổi gì.
    for target in [viet, ha, 999] {
        let err = svc::deactivate_employee(
            &pool,
            DeactivateEmployeeInput {
                id: ha,
                reassign_to: Some(target),
            },
        )
        .await
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::Validation);
        assert_eq!(err.field.as_deref(), Some("reassignTo"));
    }
    assert_eq!(assignee_of(&pool, t).await, Some(ha));
    assert_eq!(
        svc::get_employee(&pool, ha).await.unwrap().status,
        EmployeeStatus::Active
    );

    let res = svc::deactivate_employee(
        &pool,
        DeactivateEmployeeInput {
            id: ha,
            reassign_to: None,
        },
    )
    .await
    .unwrap();
    assert_eq!(res.reassigned_count, 1);
    assert_eq!(assignee_of(&pool, t).await, None);
    assert_eq!(
        history_of(&pool, t).await,
        vec![(
            "assignee".to_string(),
            Some("Lê Thu Hà".to_string()),
            Some("Chưa giao".to_string())
        )]
    );
}

#[tokio::test]
async fn list_filters_searches_folded_and_counts() {
    let pool = db::open_memory().await.unwrap();
    let ha = create(&pool, "Lê Thu Hà").await;
    let anh = create(&pool, "Đặng Mai Anh").await;
    let viet = create(&pool, "Bùi Quốc Việt").await;
    svc::deactivate_employee(
        &pool,
        DeactivateEmployeeInput {
            id: viet,
            reassign_to: None,
        },
    )
    .await
    .unwrap();
    let clock = Clock::now();
    insert_task(
        &pool,
        T {
            assignee: Some(ha),
            due: Some("2000-01-01"),
            ..T::new("VC-1", 1, "in_progress")
        },
    )
    .await;
    insert_task(
        &pool,
        T {
            assignee: Some(ha),
            due: Some(clock.today.as_str()),
            ..T::new("VC-2", 1, "new")
        },
    )
    .await;
    insert_task(
        &pool,
        T {
            assignee: Some(ha),
            due: Some("2000-01-01"),
            deleted_at: Some(1),
            ..T::new("VC-3", 1, "new")
        },
    )
    .await;
    let now = now_ms();
    insert_task(
        &pool,
        T {
            assignee: Some(ha),
            actual_end_at: Some(now - DAY_MS),
            ..T::new("VC-4", 1, "done")
        },
    )
    .await;
    insert_task(
        &pool,
        T {
            assignee: Some(ha),
            actual_end_at: Some(now - 31 * DAY_MS),
            ..T::new("VC-5", 1, "done")
        },
    )
    .await;

    let list = |status, q: Option<&str>| {
        let pool = pool.clone();
        let q = q.map(str::to_string);
        async move {
            svc::list_employees(&pool, ListEmployeesInput { status, q })
                .await
                .unwrap()
                .into_iter()
                .map(|e| e.id)
                .collect::<Vec<_>>()
        }
    };
    // "Tôi" đầu tiên, rồi theo tên (không dấu): "Dang Mai Anh" < "Le Thu Ha".
    assert_eq!(
        list(EmployeeStatusFilter::Active, None).await,
        vec![1, anh, ha]
    );
    assert_eq!(list(EmployeeStatusFilter::Inactive, None).await, vec![viet]);
    assert_eq!(
        list(EmployeeStatusFilter::All, None).await,
        vec![1, viet, anh, ha]
    );
    assert_eq!(
        list(EmployeeStatusFilter::All, Some("le thu")).await,
        vec![ha]
    );
    assert_eq!(
        list(EmployeeStatusFilter::All, Some("dang")).await,
        vec![anh]
    );

    let rows = svc::list_employees(
        &pool,
        ListEmployeesInput {
            status: EmployeeStatusFilter::Active,
            q: Some("HÀ".into()),
        },
    )
    .await
    .unwrap();
    assert_eq!((rows[0].open_count, rows[0].overdue_count), (2, 1));

    let d = svc::get_employee(&pool, ha).await.unwrap();
    assert_eq!((d.open_count, d.overdue_count, d.done_30d_count), (2, 1, 1));
}

#[tokio::test]
async fn create_employee_validates_fields() {
    let pool = db::open_memory().await.unwrap();
    let err = svc::create_employee(
        &pool,
        CreateEmployeeInput {
            full_name: "   ".into(),
            title: None,
            phone: None,
            email: None,
            color: "#2F80ED".into(),
        },
    )
    .await
    .unwrap_err();
    assert_eq!(err.field.as_deref(), Some("fullName"));
    assert_eq!(err.message, "Vui lòng nhập họ tên.");
    let err = svc::create_employee(
        &pool,
        CreateEmployeeInput {
            full_name: "A".into(),
            title: None,
            phone: Some("0".repeat(21)),
            email: None,
            color: "#2F80ED".into(),
        },
    )
    .await
    .unwrap_err();
    assert_eq!(err.field.as_deref(), Some("phone"));
}

#[tokio::test]
async fn settings_theme_roundtrip() {
    let pool = db::open_memory().await.unwrap();
    let state = AppState::new(pool, PathBuf::from("du-lieu"));
    let s = settings_service::get_settings(&state).await.unwrap();
    assert_eq!(s.theme, Theme::System);
    assert_eq!(s.self_employee_id, 1);
    assert_eq!(s.data_dir, "du-lieu");
    let s = settings_service::update_settings(&state, UpdateSettingsInput { theme: Theme::Dark })
        .await
        .unwrap();
    assert_eq!(s.theme, Theme::Dark);
    let s = settings_service::get_settings(&state).await.unwrap();
    assert_eq!(s.theme, Theme::Dark);
}
