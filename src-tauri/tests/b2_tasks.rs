//! Test tích hợp B2: mã việc, trạng thái, lịch sử, tìm kiếm, lọc, Tổng quan, Thùng rác, tệp.

use std::path::{Path, PathBuf};

use quan_ly_task_lib::db;
use quan_ly_task_lib::domain::dates::{self, TRASH_RETENTION_MS};
use quan_ly_task_lib::dto::{
    AddAttachmentsInput, AddCommentInput, AddSubtaskInput, AssigneeFilter, CreateTaskInput,
    DueFilter, HistoryField, Id, SetTaskStatusInput, SubtaskDraft, TaskDetail, TaskFilter,
    TaskPatch, TaskStatus, UnassignedTag, UpdateSubtaskInput, UpdateTaskInput,
};
use quan_ly_task_lib::services::{
    attachment_service, dashboard_service, task_service, trash_service,
};
use quan_ly_task_lib::{AppState, ErrorCode};
use sqlx::SqlitePool;

fn temp_dir() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("qlt-b2-{}", uuid::Uuid::new_v4().simple()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

async fn setup() -> (AppState, PathBuf) {
    let pool = db::open_memory().await.unwrap();
    let dir = temp_dir();
    (AppState::new(pool, dir.clone()), dir)
}

async fn add_project(pool: &SqlitePool, code: &str, name: &str) -> Id {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO projects (code, name, color, next_task_no, created_at, updated_at)
         VALUES (?, ?, '#5B8DEF', 1, 0, 0) RETURNING id",
    )
    .bind(code)
    .bind(name)
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn add_employee(pool: &SqlitePool, name: &str, active: bool) -> Id {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO employees (full_name, color, is_self, status, created_at, updated_at)
         VALUES (?, '#6E56CF', 0, ?, 0, 0) RETURNING id",
    )
    .bind(name)
    .bind(if active { "active" } else { "inactive" })
    .fetch_one(pool)
    .await
    .unwrap()
}

fn new_task(project_id: Id, title: &str) -> CreateTaskInput {
    CreateTaskInput {
        project_id,
        title: title.to_string(),
        description: None,
        assignee_id: None,
        creator_id: 1,
        status: TaskStatus::New,
        status_note: None,
        priority: 2,
        start_date: None,
        due_date: None,
        subtasks: vec![],
        file_paths: vec![],
    }
}

async fn create(state: &AppState, input: CreateTaskInput) -> TaskDetail {
    task_service::create_task(state, input).await.unwrap()
}

async fn update(state: &AppState, id: Id, patch: TaskPatch) -> TaskDetail {
    task_service::update_task(state, UpdateTaskInput { id, patch })
        .await
        .unwrap()
}

async fn set_status(
    state: &AppState,
    id: Id,
    status: TaskStatus,
    note: Option<&str>,
) -> TaskDetail {
    task_service::set_task_status(
        &state.pool,
        SetTaskStatusInput {
            id,
            status,
            note: note.map(str::to_string),
        },
    )
    .await
    .unwrap()
}

/// (cũ, mới) của dòng lịch sử mới nhất có trường `field`.
fn entry(d: &TaskDetail, field: HistoryField) -> (Option<&str>, Option<&str>) {
    let h = d
        .history
        .iter()
        .find(|h| h.field == field)
        .unwrap_or_else(|| panic!("thiếu lịch sử {field:?}"));
    (h.old_value.as_deref(), h.new_value.as_deref())
}

fn days_from_today(n: i64) -> String {
    let d = chrono::Local::now().date_naive() + chrono::Duration::days(n);
    dates::iso(d)
}

fn filter() -> TaskFilter {
    TaskFilter::default()
}

fn codes(rows: &[quan_ly_task_lib::dto::TaskRow]) -> Vec<&str> {
    rows.iter().map(|r| r.code.as_str()).collect()
}

fn stored_file(dir: &Path, stored_path: &str) -> PathBuf {
    dir.join("attachments")
        .join(stored_path.trim_start_matches("attachments/"))
}

#[tokio::test]
async fn r01_code_increments_per_project_and_never_changes() {
    let (state, _dir) = setup().await;
    let web = add_project(&state.pool, "WEB", "Website").await;
    let a = create(&state, new_task(web, "A")).await;
    let b = create(&state, new_task(web, "B")).await;
    let c = create(&state, new_task(1, "C")).await;
    assert_eq!(
        [
            a.task.code.as_str(),
            b.task.code.as_str(),
            c.task.code.as_str()
        ],
        ["WEB-1", "WEB-2", "VC-1"]
    );
    assert_eq!(entry(&a, HistoryField::Created), (None, Some("WEB-1")));
    assert_eq!(a.history.len(), 1);

    // Chuyển dự án: mã giữ nguyên, lịch sử ghi tên dự án.
    let moved = update(
        &state,
        b.task.id,
        TaskPatch {
            project_id: Some(1),
            ..Default::default()
        },
    )
    .await;
    assert_eq!(moved.task.code, "WEB-2");
    assert_eq!(moved.task.project_id, 1);
    assert_eq!(
        entry(&moved, HistoryField::Project),
        (Some("Website"), Some("Việc chung"))
    );
    let d = create(&state, new_task(1, "D")).await;
    assert_eq!(d.task.code, "VC-2");
    let e = create(&state, new_task(web, "E")).await;
    assert_eq!(e.task.code, "WEB-3");

    let err = task_service::create_task(&state, new_task(999, "X"))
        .await
        .unwrap_err();
    assert_eq!(err.field.as_deref(), Some("projectId"));
}

#[tokio::test]
async fn r03_assignee_must_be_active_when_chosen() {
    let (state, _dir) = setup().await;
    let lan = add_employee(&state.pool, "Lan", true).await;
    let hung = add_employee(&state.pool, "Hùng", false).await;

    let mut input = new_task(1, "A");
    input.assignee_id = Some(hung);
    let err = task_service::create_task(&state, input).await.unwrap_err();
    assert_eq!(err.code, ErrorCode::Validation);
    assert_eq!(err.field.as_deref(), Some("assigneeId"));

    let mut input = new_task(1, "A");
    input.assignee_id = Some(lan);
    let t = create(&state, input).await;
    assert_eq!(t.task.assignee_name.as_deref(), Some("Lan"));

    // Lan nghỉ: sửa trường khác vẫn giữ được người phụ trách cũ.
    sqlx::query("UPDATE employees SET status = 'inactive' WHERE id = ?")
        .bind(lan)
        .execute(&state.pool)
        .await
        .unwrap();
    let kept = update(
        &state,
        t.task.id,
        TaskPatch {
            title: Some("A2".into()),
            assignee_id: Some(Some(lan)),
            ..Default::default()
        },
    )
    .await;
    assert!(kept.task.assignee_inactive);
    let err = task_service::update_task(
        &state,
        UpdateTaskInput {
            id: t.task.id,
            patch: TaskPatch {
                assignee_id: Some(Some(hung)),
                ..Default::default()
            },
        },
    )
    .await
    .unwrap_err();
    assert_eq!(err.field.as_deref(), Some("assigneeId"));

    let cleared = update(
        &state,
        t.task.id,
        TaskPatch {
            assignee_id: Some(None),
            ..Default::default()
        },
    )
    .await;
    assert_eq!(cleared.task.assignee_id, None);
    assert_eq!(
        entry(&cleared, HistoryField::Assignee),
        (Some("Lan"), Some("Chưa giao"))
    );
}

#[tokio::test]
async fn r06_date_ranges_rejected() {
    let (state, _dir) = setup().await;
    let mut input = new_task(1, "A");
    input.start_date = Some("2026-09-13".into());
    input.due_date = Some("2026-09-12".into());
    let err = task_service::create_task(&state, input).await.unwrap_err();
    assert_eq!(err.field.as_deref(), Some("startDate"));
    assert_eq!(err.message, "Ngày bắt đầu phải trước hoặc bằng hạn chót.");

    let t = create(&state, new_task(1, "B")).await;
    update(
        &state,
        t.task.id,
        TaskPatch {
            start_date: Some(Some("2026-09-10".into())),
            ..Default::default()
        },
    )
    .await;
    let err = task_service::update_task(
        &state,
        UpdateTaskInput {
            id: t.task.id,
            patch: TaskPatch {
                due_date: Some(Some("2026-09-01".into())),
                ..Default::default()
            },
        },
    )
    .await
    .unwrap_err();
    assert_eq!(err.field.as_deref(), Some("startDate"));

    let err = task_service::update_task(
        &state,
        UpdateTaskInput {
            id: t.task.id,
            patch: TaskPatch {
                actual_start_at: Some(Some(2_000)),
                actual_end_at: Some(Some(1_000)),
                ..Default::default()
            },
        },
    )
    .await
    .unwrap_err();
    assert_eq!(err.field.as_deref(), Some("actualEndAt"));
    assert_eq!(
        err.message,
        "Kết thúc thực tế phải sau hoặc bằng bắt đầu thực tế."
    );
}

#[tokio::test]
async fn r07_purge_removes_subtasks_comments_files_and_history() {
    let (state, dir) = setup().await;
    let src = dir.join("bao-gia.pdf");
    std::fs::write(&src, b"pdf").unwrap();
    let mut input = new_task(1, "Có dữ liệu con");
    input.subtasks = vec!["Việc con 1".into(), "   ".into()];
    input.file_paths = vec![src.to_string_lossy().into_owned()];
    let t = create(&state, input).await;
    assert_eq!(t.subtasks.len(), 1);
    assert_eq!(t.attachments.len(), 1);
    task_service::add_comment(
        &state.pool,
        AddCommentInput {
            task_id: t.task.id,
            author_id: 1,
            body: "Ghi chú".into(),
        },
    )
    .await
    .unwrap();
    let stored: String = sqlx::query_scalar("SELECT stored_path FROM task_attachments")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let file = stored_file(&dir, &stored);
    assert!(file.is_file());

    task_service::delete_task(&state.pool, t.task.id)
        .await
        .unwrap();
    assert!(task_service::list_tasks(&state.pool, filter())
        .await
        .unwrap()
        .is_empty());
    let trash = trash_service::list_trash(&state).await.unwrap();
    assert_eq!(trash.len(), 1);
    assert_eq!(trash[0].days_left, 30);
    assert_eq!(trash[0].code, "VC-1");

    trash_service::purge_task(&state, t.task.id).await.unwrap();
    for sql in [
        "SELECT COUNT(*) FROM tasks",
        "SELECT COUNT(*) FROM subtasks",
        "SELECT COUNT(*) FROM task_comments",
        "SELECT COUNT(*) FROM task_attachments",
        "SELECT COUNT(*) FROM task_history",
    ] {
        let n: i64 = sqlx::query_scalar(sql)
            .fetch_one(&state.pool)
            .await
            .unwrap();
        assert_eq!(n, 0, "{sql}");
    }
    assert!(!file.exists());
    assert!(src.is_file(), "tệp gốc của người dùng không bị đụng tới");
}

#[tokio::test]
async fn r07_restore_and_auto_purge_after_30_days() {
    let (state, _dir) = setup().await;
    let old = create(&state, new_task(1, "Cũ")).await;
    let recent = create(&state, new_task(1, "Mới")).await;
    set_status(&state, recent.task.id, TaskStatus::InProgress, None).await;
    task_service::delete_task(&state.pool, old.task.id)
        .await
        .unwrap();
    task_service::delete_task(&state.pool, recent.task.id)
        .await
        .unwrap();
    sqlx::query("UPDATE tasks SET deleted_at = ? WHERE id = ?")
        .bind(dates::now_ms() - TRASH_RETENTION_MS - 1_000)
        .bind(old.task.id)
        .execute(&state.pool)
        .await
        .unwrap();

    assert_eq!(trash_service::purge_expired(&state).await.unwrap(), 1);
    let trash = trash_service::list_trash(&state).await.unwrap();
    assert_eq!(codes_trash(&trash), ["VC-2"]);

    trash_service::restore_task(&state.pool, recent.task.id)
        .await
        .unwrap();
    let back = task_service::get_task(&state.pool, recent.task.id)
        .await
        .unwrap();
    assert_eq!(back.task.code, "VC-2");
    assert_eq!(back.task.status, TaskStatus::InProgress);
    assert_eq!(back.task.deleted_at, None);
    assert_eq!(back.history[0].field, HistoryField::Restored);
    assert_eq!(back.history[1].field, HistoryField::Deleted);
    let err = trash_service::restore_task(&state.pool, recent.task.id)
        .await
        .unwrap_err();
    assert_eq!(err.code, ErrorCode::NotFound);

    // Dọn sạch.
    task_service::delete_task(&state.pool, recent.task.id)
        .await
        .unwrap();
    trash_service::empty_trash(&state).await.unwrap();
    assert!(trash_service::list_trash(&state).await.unwrap().is_empty());
}

fn codes_trash(rows: &[quan_ly_task_lib::dto::TrashRow]) -> Vec<&str> {
    rows.iter().map(|r| r.code.as_str()).collect()
}

#[tokio::test]
async fn r08_history_records_each_field_with_display_text() {
    let (state, _dir) = setup().await;
    let lan = add_employee(&state.pool, "Lan", true).await;
    let t = create(&state, new_task(1, "Báo cáo")).await;
    let d = update(
        &state,
        t.task.id,
        TaskPatch {
            title: Some("Báo cáo quý".into()),
            description: Some(Some("Chi tiết".into())),
            priority: Some(3),
            assignee_id: Some(Some(lan)),
            due_date: Some(Some("2026-09-15".into())),
            subtasks: Some(vec![SubtaskDraft {
                id: None,
                title: "Con".into(),
            }]),
            ..Default::default()
        },
    )
    .await;
    assert_eq!(
        entry(&d, HistoryField::Title),
        (Some("Báo cáo"), Some("Báo cáo quý"))
    );
    assert_eq!(entry(&d, HistoryField::Description), (None, None));
    assert_eq!(
        entry(&d, HistoryField::Priority),
        (Some("Trung bình"), Some("Cao"))
    );
    assert_eq!(
        entry(&d, HistoryField::Assignee),
        (Some("Chưa giao"), Some("Lan"))
    );
    assert_eq!(entry(&d, HistoryField::DueDate), (None, Some("15/09/2026")));
    // 5 trường + "Tạo việc"; việc con không ghi lịch sử.
    assert_eq!(d.history.len(), 6);
    assert_eq!(d.subtasks.len(), 1);

    // Gửi lại giá trị cũ → không ghi thêm.
    let same = update(
        &state,
        t.task.id,
        TaskPatch {
            title: Some("  Báo cáo quý ".into()),
            priority: Some(3),
            ..Default::default()
        },
    )
    .await;
    assert_eq!(same.history.len(), 6);

    // Việc con, bình luận không ghi lịch sử (R-08).
    let sub = task_service::add_subtask(
        &state.pool,
        AddSubtaskInput {
            task_id: t.task.id,
            title: "Con 2".into(),
        },
    )
    .await
    .unwrap();
    assert_eq!(sub.position, 2);
    let ticked = task_service::update_subtask(
        &state.pool,
        UpdateSubtaskInput {
            id: sub.id,
            title: None,
            is_done: Some(true),
        },
    )
    .await
    .unwrap();
    assert!(ticked.is_done);
    task_service::add_comment(
        &state.pool,
        AddCommentInput {
            task_id: t.task.id,
            author_id: 1,
            body: "OK".into(),
        },
    )
    .await
    .unwrap();
    let after = task_service::get_task(&state.pool, t.task.id)
        .await
        .unwrap();
    assert_eq!(after.history.len(), 6);
    assert_eq!(after.comments.len(), 1);

    // Danh sách việc con đầy đủ: giữ tick dòng cũ, xoá dòng vắng mặt, đổi thứ tự.
    let first = after.subtasks[0].id;
    let synced = update(
        &state,
        t.task.id,
        TaskPatch {
            subtasks: Some(vec![
                SubtaskDraft {
                    id: Some(sub.id),
                    title: "Con 2".into(),
                },
                SubtaskDraft {
                    id: None,
                    title: "Con 3".into(),
                },
            ]),
            ..Default::default()
        },
    )
    .await;
    let titles: Vec<(&str, bool)> = synced
        .subtasks
        .iter()
        .map(|s| (s.title.as_str(), s.is_done))
        .collect();
    assert_eq!(titles, [("Con 2", true), ("Con 3", false)]);
    assert!(synced.subtasks.iter().all(|s| s.id != first));
    assert_eq!(synced.history.len(), 6);
}

#[tokio::test]
async fn status_rules_fill_and_clear_actual_times() {
    let (state, _dir) = setup().await;
    let before = dates::now_ms();
    let t = create(&state, new_task(1, "A")).await;

    let s1 = set_status(&state, t.task.id, TaskStatus::InProgress, None).await;
    let start = s1.task.actual_start_at.unwrap();
    assert!(start >= before);
    assert_eq!(
        entry(&s1, HistoryField::Status),
        (Some("Mới"), Some("Đang làm"))
    );
    assert_eq!(entry(&s1, HistoryField::ActualStart).0, None);

    // Kết thúc thực tế sửa tay về giá trị cũ; vào Hoàn thành thì luôn = bây giờ.
    update(
        &state,
        t.task.id,
        TaskPatch {
            actual_start_at: Some(Some(500)),
            actual_end_at: Some(Some(1_000)),
            ..Default::default()
        },
    )
    .await;
    let s2 = set_status(&state, t.task.id, TaskStatus::Done, None).await;
    let end = s2.task.actual_end_at.unwrap();
    assert!(end >= before);
    assert_eq!(s2.task.actual_start_at, Some(500));
    assert_eq!(
        entry(&s2, HistoryField::Status),
        (Some("Đang làm"), Some("Hoàn thành"))
    );
    assert!(entry(&s2, HistoryField::ActualEnd).1.is_some());

    // Rời Hoàn thành → xoá Kết thúc thực tế; Đang chờ lưu lý do.
    let s3 = set_status(&state, t.task.id, TaskStatus::Waiting, Some("  Chờ khách ")).await;
    assert_eq!(s3.task.actual_end_at, None);
    assert_eq!(s3.task.status_note.as_deref(), Some("Chờ khách"));
    assert_eq!(
        entry(&s3, HistoryField::Status),
        (Some("Hoàn thành"), Some("Đang chờ (lý do: Chờ khách)"))
    );
    // Rời Đang chờ → xoá lý do, Bắt đầu thực tế giữ nguyên.
    let s4 = set_status(&state, t.task.id, TaskStatus::InProgress, None).await;
    assert_eq!(s4.task.status_note, None);
    assert_eq!(s4.task.actual_start_at, Some(500));
    assert_eq!(
        entry(&s4, HistoryField::Status),
        (Some("Đang chờ (lý do: Chờ khách)"), Some("Đang làm"))
    );
    // Cùng trạng thái → không đổi gì.
    let s5 = set_status(&state, t.task.id, TaskStatus::InProgress, None).await;
    assert_eq!(s5.history.len(), s4.history.len());

    // Đổi trạng thái qua form (update_task) cũng áp quy tắc.
    let s6 = update(
        &state,
        t.task.id,
        TaskPatch {
            status: Some(TaskStatus::Cancelled),
            status_note: Some(Some("Khách huỷ".into())),
            ..Default::default()
        },
    )
    .await;
    assert_eq!(s6.task.status_note.as_deref(), Some("Khách huỷ"));

    // Tạo thẳng ở Đang làm / Hoàn thành / Đang chờ.
    let mut i = new_task(1, "B");
    i.status = TaskStatus::Done;
    let b = create(&state, i).await;
    assert!(b.task.actual_end_at.unwrap() >= before);
    assert_eq!(b.task.actual_start_at, None);
    let mut i = new_task(1, "C");
    i.status = TaskStatus::InProgress;
    let c = create(&state, i).await;
    assert!(c.task.actual_start_at.is_some());
    let mut i = new_task(1, "D");
    i.status = TaskStatus::Waiting;
    i.status_note = Some("Chờ duyệt".into());
    let d = create(&state, i).await;
    assert_eq!(d.task.status_note.as_deref(), Some("Chờ duyệt"));
    let mut i = new_task(1, "E");
    i.status_note = Some("bỏ qua".into());
    assert_eq!(create(&state, i).await.task.status_note, None);
}

#[tokio::test]
async fn r09_attachment_limit_copy_and_remove() {
    let (state, dir) = setup().await;
    let big = dir.join("lon.bin");
    std::fs::File::create(&big)
        .unwrap()
        .set_len(50 * 1024 * 1024 + 1)
        .unwrap();
    let mut input = new_task(1, "A");
    input.file_paths = vec![big.to_string_lossy().into_owned()];
    let err = task_service::create_task(&state, input).await.unwrap_err();
    assert_eq!(err.code, ErrorCode::FileTooLarge);
    assert_eq!(err.message, "Tệp “lon.bin” vượt quá 50 MB.");
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tasks")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(n, 0);

    let t = create(&state, new_task(1, "B")).await;
    let small = dir.join("bao-gia.PDF");
    std::fs::write(&small, b"abc").unwrap();
    let added = attachment_service::add_attachments(
        &state,
        AddAttachmentsInput {
            task_id: t.task.id,
            file_paths: vec![small.to_string_lossy().into_owned()],
        },
    )
    .await
    .unwrap();
    assert_eq!(added.len(), 1);
    assert_eq!(added[0].file_name, "bao-gia.PDF");
    assert_eq!(added[0].size_bytes, 3);
    let stored: String = sqlx::query_scalar("SELECT stored_path FROM task_attachments")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert!(stored.starts_with("attachments/") && stored.ends_with(".pdf"));
    let file = stored_file(&dir, &stored);
    assert_eq!(std::fs::read(&file).unwrap(), b"abc");
    let d = task_service::get_task(&state.pool, t.task.id)
        .await
        .unwrap();
    assert_eq!(
        entry(&d, HistoryField::AttachmentAdded),
        (None, Some("bao-gia.PDF"))
    );

    attachment_service::remove_attachment(&state, added[0].id)
        .await
        .unwrap();
    assert!(!file.exists());
    assert!(small.exists());
    let d = task_service::get_task(&state.pool, t.task.id)
        .await
        .unwrap();
    assert!(d.attachments.is_empty());
    assert_eq!(
        entry(&d, HistoryField::AttachmentRemoved),
        (Some("bao-gia.PDF"), None)
    );

    // Thêm/gỡ qua form sửa.
    let via_patch = update(
        &state,
        t.task.id,
        TaskPatch {
            add_file_paths: vec![small.to_string_lossy().into_owned()],
            ..Default::default()
        },
    )
    .await;
    assert_eq!(via_patch.attachments.len(), 1);
    let removed = update(
        &state,
        t.task.id,
        TaskPatch {
            remove_attachment_ids: vec![via_patch.attachments[0].id],
            ..Default::default()
        },
    )
    .await;
    assert!(removed.attachments.is_empty());

    let err = attachment_service::add_attachments(
        &state,
        AddAttachmentsInput {
            task_id: t.task.id,
            file_paths: vec![dir.join("khong-co.txt").to_string_lossy().into_owned()],
        },
    )
    .await
    .unwrap_err();
    assert_eq!(err.code, ErrorCode::FileMissing);
}

#[tokio::test]
async fn r11_search_by_code_or_title_without_marks() {
    let (state, _dir) = setup().await;
    create(&state, new_task(1, "Hoá đơn tháng 9")).await;
    create(&state, new_task(1, "Báo giá")).await;
    create(&state, new_task(1, "Đăng nhập bằng Google")).await;
    let search = |q: &str| TaskFilter {
        q: Some(q.to_string()),
        ..Default::default()
    };
    let rows = task_service::list_tasks(&state.pool, search("hoa don"))
        .await
        .unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].title, "Hoá đơn tháng 9");
    let rows = task_service::list_tasks(&state.pool, search("HOÁ ĐƠN"))
        .await
        .unwrap();
    assert_eq!(rows.len(), 1);
    let rows = task_service::list_tasks(&state.pool, search("dang nhap"))
        .await
        .unwrap();
    assert_eq!(codes(&rows), ["VC-3"]);
    let rows = task_service::list_tasks(&state.pool, search("vc-2"))
        .await
        .unwrap();
    assert_eq!(codes(&rows), ["VC-2"]);
    let rows = task_service::list_tasks(&state.pool, search("  "))
        .await
        .unwrap();
    assert_eq!(codes(&rows), ["VC-3", "VC-2", "VC-1"]);
}

#[tokio::test]
async fn list_filters_counts_and_dashboard() {
    let (state, _dir) = setup().await;
    let lan = add_employee(&state.pool, "Lan", true).await;
    add_employee(&state.pool, "Hùng", false).await;

    let mut a = new_task(1, "A quá hạn");
    a.assignee_id = Some(lan);
    a.due_date = Some(days_from_today(-1));
    a.subtasks = vec!["x".into(), "y".into()];
    let a = create(&state, a).await;
    let mut b = new_task(1, "B hôm nay");
    b.due_date = Some(days_from_today(0));
    let b = create(&state, b).await;
    let mut c = new_task(1, "C xong");
    c.status = TaskStatus::Done;
    let c = create(&state, c).await;
    let mut d = new_task(1, "D chờ");
    d.status = TaskStatus::Waiting;
    d.assignee_id = Some(lan);
    let d = create(&state, d).await;
    let mut e = new_task(1, "E đã xoá");
    e.due_date = Some(days_from_today(-3));
    let e = create(&state, e).await;
    task_service::delete_task(&state.pool, e.task.id)
        .await
        .unwrap();
    task_service::update_subtask(
        &state.pool,
        UpdateSubtaskInput {
            id: a.subtasks[0].id,
            title: None,
            is_done: Some(true),
        },
    )
    .await
    .unwrap();

    let list = |f: TaskFilter| {
        let pool = state.pool.clone();
        async move { task_service::list_tasks(&pool, f).await.unwrap() }
    };
    let rows = list(filter()).await;
    assert_eq!(codes(&rows), ["VC-4", "VC-2", "VC-1"]);
    let row_a = rows.iter().find(|r| r.id == a.task.id).unwrap();
    assert_eq!((row_a.subtask_done, row_a.subtask_total), (1, 2));
    assert_eq!(row_a.assignee_name.as_deref(), Some("Lan"));

    let rows = list(TaskFilter {
        assignee: Some(AssigneeFilter::Unassigned(UnassignedTag::Unassigned)),
        ..Default::default()
    })
    .await;
    assert_eq!(codes(&rows), [b.task.code.as_str()]);
    let rows = list(TaskFilter {
        assignee: Some(AssigneeFilter::Id(lan)),
        ..Default::default()
    })
    .await;
    assert_eq!(codes(&rows), [d.task.code.as_str(), a.task.code.as_str()]);
    let rows = list(TaskFilter {
        due: Some(DueFilter::Overdue),
        ..Default::default()
    })
    .await;
    assert_eq!(codes(&rows), [a.task.code.as_str()]);
    let rows = list(TaskFilter {
        due: Some(DueFilter::NoDue),
        ..Default::default()
    })
    .await;
    assert_eq!(codes(&rows), [d.task.code.as_str()]);
    let rows = list(TaskFilter {
        due: Some(DueFilter::ThisWeek),
        ..Default::default()
    })
    .await;
    assert!(rows.iter().any(|r| r.id == b.task.id));
    let rows = list(TaskFilter {
        statuses: Some(vec![TaskStatus::Done]),
        ..Default::default()
    })
    .await;
    assert_eq!(codes(&rows), [c.task.code.as_str()]);
    let rows = list(TaskFilter {
        project_id: Some(999),
        ..Default::default()
    })
    .await;
    assert!(rows.is_empty());

    let dash = dashboard_service::get_dashboard(&state.pool).await.unwrap();
    assert_eq!(dash.open_count, 3);
    assert_eq!(dash.overdue_count, 1);
    assert_eq!(dash.waiting_count, 1);
    assert_eq!(dash.done_this_week_count, 1);
    let attention: Vec<Id> = dash.attention.iter().map(|r| r.id).collect();
    assert_eq!(attention, [a.task.id, b.task.id]);
    let people: Vec<(&str, i64, i64)> = dash
        .by_employee
        .iter()
        .map(|w| (w.full_name.as_str(), w.open_count, w.overdue_count))
        .collect();
    assert_eq!(people, [("Lan", 2, 1), ("Tôi", 0, 0)]);
}

#[tokio::test]
async fn comment_author_must_be_active() {
    let (state, _dir) = setup().await;
    let hung = add_employee(&state.pool, "Hùng", false).await;
    let t = create(&state, new_task(1, "A")).await;
    let err = task_service::add_comment(
        &state.pool,
        AddCommentInput {
            task_id: t.task.id,
            author_id: hung,
            body: "x".into(),
        },
    )
    .await
    .unwrap_err();
    assert_eq!(err.field.as_deref(), Some("authorId"));
    let err = task_service::add_comment(
        &state.pool,
        AddCommentInput {
            task_id: t.task.id,
            author_id: 1,
            body: "   ".into(),
        },
    )
    .await
    .unwrap_err();
    assert_eq!(err.field.as_deref(), Some("body"));
    let c = task_service::add_comment(
        &state.pool,
        AddCommentInput {
            task_id: t.task.id,
            author_id: 1,
            body: " Xong rồi ".into(),
        },
    )
    .await
    .unwrap();
    assert_eq!(c.body, "Xong rồi");
    assert_eq!(c.author_name, "Tôi");
    task_service::delete_comment(&state.pool, c.id)
        .await
        .unwrap();
    let d = task_service::get_task(&state.pool, t.task.id)
        .await
        .unwrap();
    assert!(d.comments.is_empty());
}
