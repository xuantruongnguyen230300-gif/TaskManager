//! Việc, việc con, bình luận (docs/05 §5). Chủ: B2.
//! Mọi ghi của một việc: `db::begin_write` → kiểm tra (domain::validate) → ghi → `history::record` → commit.
//! Đổi trạng thái luôn qua `domain::status::apply_status_change`. Mọi thay đổi đặt `tasks.updated_at = now`.

use std::collections::HashSet;

use sqlx::{SqliteConnection, SqlitePool};

use crate::db;
use crate::domain::dates::{self, Clock};
use crate::domain::labels::{self, date_label, datetime_label, priority_label, status_with_note};
use crate::domain::status::{apply_status_change, StatusFields};
use crate::domain::text::fold_vi;
use crate::domain::validate;
use crate::dto::{
    AddCommentInput, AddSubtaskInput, AssigneeFilter, Comment, CreateTaskInput, DueFilter,
    EmployeeStatus, HistoryField, Id, SetTaskStatusInput, Subtask, TaskDetail, TaskFilter,
    TaskPatch, TaskRow, TaskStatus, UpdateSubtaskInput, UpdateTaskInput,
};
use crate::error::{AppError, AppResult};
use crate::repo;
use crate::repo::tasks::{NewTask, TaskQuery, TaskRecord};
use crate::services::attachment_service::{self, CopiedFile};
use crate::services::history::{self, Change};
use crate::state::AppState;

const PROJECT_MISSING: &str = "Vui lòng chọn dự án.";
const ASSIGNEE_INACTIVE: &str = "Người phụ trách phải là nhân viên đang làm việc.";
const CREATOR_MISSING: &str = "Vui lòng chọn người tạo.";
const CREATOR_INACTIVE: &str = "Người tạo phải là nhân viên đang làm việc.";
const AUTHOR_INACTIVE: &str = "Tác giả phải là nhân viên đang làm việc.";
const SUBTASK_EMPTY: &str = "Vui lòng nhập việc con.";

pub fn task_not_found() -> AppError {
    AppError::not_found("Không tìm thấy việc.")
}

fn subtask_not_found() -> AppError {
    AppError::not_found("Không tìm thấy việc con.")
}

fn comment_not_found() -> AppError {
    AppError::not_found("Không tìm thấy bình luận.")
}

// ======================= Đọc =======================

/// docs/03 Q2 + lọc `q` bằng `fold_vi(code + " " + title)`. `statuses` trống = 3 trạng thái đang mở.
pub async fn list_tasks(pool: &SqlitePool, filter: TaskFilter) -> AppResult<Vec<TaskRow>> {
    let clock = Clock::now();
    let statuses: Vec<&str> = match &filter.statuses {
        Some(list) if !list.is_empty() => list.iter().map(|s| s.as_str()).collect(),
        _ => TaskStatus::OPEN.iter().map(|s| s.as_str()).collect(),
    };
    let (assignee_id, unassigned) = match filter.assignee {
        Some(AssigneeFilter::Id(id)) => (Some(id), false),
        Some(AssigneeFilter::Unassigned(_)) => (None, true),
        None => (None, false),
    };
    let due = filter.due.map(|d| match d {
        DueFilter::Overdue => "overdue",
        DueFilter::ThisWeek => "thisWeek",
        DueFilter::NoDue => "noDue",
    });
    let query = TaskQuery {
        project_id: filter.project_id,
        assignee_id,
        unassigned,
        statuses_json: serde_json::to_string(&statuses)?,
        due,
        today: &clock.today,
        monday: &clock.monday,
        sunday: &clock.sunday,
    };
    let mut conn = pool.acquire().await?;
    let mut rows = repo::tasks::list_rows(&mut conn, &query).await?;
    // R-11: tìm theo mã hoặc tiêu đề, không phân biệt hoa thường và dấu.
    let needle = fold_vi(filter.q.as_deref().unwrap_or("").trim());
    if !needle.is_empty() {
        rows.retain(|r| fold_vi(&format!("{} {}", r.code, r.title)).contains(&needle));
    }
    Ok(rows)
}

pub async fn get_task(pool: &SqlitePool, id: Id) -> AppResult<TaskDetail> {
    let mut conn = pool.acquire().await?;
    let task = repo::tasks::get_info(&mut conn, id)
        .await?
        .ok_or_else(task_not_found)?;
    Ok(TaskDetail {
        task,
        subtasks: repo::subtasks::list_for_task(&mut conn, id).await?,
        comments: repo::comments::list_for_task(&mut conn, id).await?,
        attachments: repo::attachments::list_for_task(&mut conn, id).await?,
        history: repo::history::list_for_task(&mut conn, id).await?,
    })
}

// ======================= Tạo việc =======================

/// Dữ liệu form tạo việc đã kiểm tra.
struct ValidNewTask {
    title: String,
    description: Option<String>,
    priority: i64,
    start_date: Option<String>,
    due_date: Option<String>,
    subtasks: Vec<String>,
}

/// R-01 sinh mã trong transaction (docs/03 Q3), chép tệp (attachment_service), lịch sử "created".
pub async fn create_task(state: &AppState, input: CreateTaskInput) -> AppResult<TaskDetail> {
    let start_date = validate::date_opt(input.start_date.as_deref(), "startDate")?;
    let due_date = validate::date_opt(input.due_date.as_deref(), "dueDate")?;
    validate::start_before_due(start_date.as_deref(), due_date.as_deref())?;
    let valid = ValidNewTask {
        title: validate::task_title(&input.title)?,
        description: clean_description(input.description.as_deref()),
        priority: validate::priority(input.priority)?,
        start_date,
        due_date,
        subtasks: clean_subtask_titles(input.subtasks.iter().map(String::as_str))?,
    };
    let files = attachment_service::inspect_files(&input.file_paths)?;
    let copied = attachment_service::copy_files(state.attachments_dir(), files).await?;
    let id = match insert_task(&state.pool, &input, &valid, &copied).await {
        Ok(id) => id,
        Err(e) => {
            attachment_service::discard(&copied);
            return Err(e);
        }
    };
    tracing::info!(task_id = id, "đã tạo việc");
    get_task(&state.pool, id).await
}

async fn insert_task(
    pool: &SqlitePool,
    input: &CreateTaskInput,
    v: &ValidNewTask,
    copied: &[CopiedFile],
) -> AppResult<Id> {
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    if let Some(a) = input.assignee_id {
        ensure_active_employee(
            &mut tx,
            a,
            "assigneeId",
            ASSIGNEE_INACTIVE,
            ASSIGNEE_INACTIVE,
        )
        .await?;
    }
    ensure_active_employee(
        &mut tx,
        input.creator_id,
        "creatorId",
        CREATOR_MISSING,
        CREATOR_INACTIVE,
    )
    .await?;
    let code = repo::tasks::next_code(&mut tx, input.project_id)
        .await?
        .ok_or_else(|| AppError::validation("projectId", PROJECT_MISSING))?;
    // Tạo ở Đang làm / Hoàn thành → ngày thực tế = bây giờ; lý do chỉ giữ cho Đang chờ / Đã huỷ.
    let status = apply_status_change(
        &StatusFields::initial(),
        input.status,
        input.status_note.as_deref(),
        now,
    );
    let new_task = NewTask {
        code: &code,
        project_id: input.project_id,
        title: &v.title,
        description: v.description.as_deref(),
        status: &status,
        priority: v.priority,
        assignee_id: input.assignee_id,
        creator_id: input.creator_id,
        start_date: v.start_date.as_deref(),
        due_date: v.due_date.as_deref(),
        now,
    };
    let id = repo::tasks::insert(&mut tx, &new_task).await?;
    for (i, title) in v.subtasks.iter().enumerate() {
        repo::subtasks::insert(&mut tx, id, title, position(i)).await?;
    }
    attachment_service::insert_rows(&mut tx, id, copied, now).await?;
    let created = Change::new(HistoryField::Created, None, Some(code));
    history::record(&mut tx, id, now, &[created]).await?;
    tx.commit().await?;
    Ok(id)
}

// ======================= Sửa việc =======================

/// Phần patch kiểm tra được không cần DB.
struct CleanPatch {
    title: Option<String>,
    description: Option<Option<String>>,
    priority: Option<i64>,
    start_date: Option<Option<String>>,
    due_date: Option<Option<String>>,
    subtasks: Option<Vec<(Option<Id>, String)>>,
}

fn clean_patch(p: &TaskPatch) -> AppResult<CleanPatch> {
    let subtasks = match &p.subtasks {
        None => None,
        Some(list) => {
            let mut out = Vec::with_capacity(list.len());
            for d in list {
                if let Some(t) = validate::subtask_title(&d.title)? {
                    out.push((d.id, t));
                }
            }
            Some(out)
        }
    };
    Ok(CleanPatch {
        title: p.title.as_deref().map(validate::task_title).transpose()?,
        description: p
            .description
            .as_ref()
            .map(|d| clean_description(d.as_deref())),
        priority: p.priority.map(validate::priority).transpose()?,
        start_date: p
            .start_date
            .as_ref()
            .map(|d| validate::date_opt(d.as_deref(), "startDate"))
            .transpose()?,
        due_date: p
            .due_date
            .as_ref()
            .map(|d| validate::date_opt(d.as_deref(), "dueDate"))
            .transpose()?,
        subtasks,
    })
}

/// So bản cũ/mới, mỗi trường đổi ghi 1 dòng lịch sử (R-08).
pub async fn update_task(state: &AppState, input: UpdateTaskInput) -> AppResult<TaskDetail> {
    let UpdateTaskInput { id, patch } = input;
    let clean = clean_patch(&patch)?;
    let files = attachment_service::inspect_files(&patch.add_file_paths)?;
    let copied = attachment_service::copy_files(state.attachments_dir(), files).await?;
    let removed = match apply_patch(&state.pool, id, &patch, clean, &copied).await {
        Ok(removed) => removed,
        Err(e) => {
            attachment_service::discard(&copied);
            return Err(e);
        }
    };
    attachment_service::remove_stored(&state.attachments_dir(), &removed);
    get_task(&state.pool, id).await
}

/// Ghi patch trong một transaction. Trả `stored_path` các tệp đã gỡ (xoá file sau commit).
async fn apply_patch(
    pool: &SqlitePool,
    id: Id,
    patch: &TaskPatch,
    clean: CleanPatch,
    copied: &[CopiedFile],
) -> AppResult<Vec<String>> {
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    let cur = load_record(&mut tx, id).await?;
    let mut next = cur.clone();
    if let Some(t) = clean.title {
        next.title = t;
    }
    if let Some(d) = clean.description {
        next.description = d;
    }
    if let Some(p) = clean.priority {
        next.priority = p;
    }
    if let Some(d) = clean.start_date {
        next.start_date = d;
    }
    if let Some(d) = clean.due_date {
        next.due_date = d;
    }
    validate::start_before_due(next.start_date.as_deref(), next.due_date.as_deref())?;
    if let Some(pid) = patch.project_id.filter(|p| *p != cur.project_id) {
        repo::tasks::project_name(&mut tx, pid)
            .await?
            .ok_or_else(|| AppError::validation("projectId", PROJECT_MISSING))?;
        next.project_id = pid;
    }
    // R-03: chỉ chọn MỚI được người đang làm việc; giữ nguyên người đã nghỉ thì không kiểm tra.
    if let Some(a) = patch.assignee_id.filter(|a| *a != cur.assignee_id) {
        if let Some(aid) = a {
            ensure_active_employee(
                &mut tx,
                aid,
                "assigneeId",
                ASSIGNEE_INACTIVE,
                ASSIGNEE_INACTIVE,
            )
            .await?;
        }
        next.assignee_id = a;
    }
    if let Some(c) = patch.creator_id.filter(|c| *c != cur.creator_id) {
        ensure_active_employee(&mut tx, c, "creatorId", CREATOR_MISSING, CREATOR_INACTIVE).await?;
        next.creator_id = c;
    }
    if patch.status.is_some() || patch.status_note.is_some() {
        let status = patch.status.unwrap_or(cur.status);
        let note = match &patch.status_note {
            Some(n) => n.clone(),
            None if status == cur.status => cur.status_note.clone(),
            None => None,
        };
        next.set_status_fields(apply_status_change(
            &cur.status_fields(),
            status,
            note.as_deref(),
            now,
        ));
    }
    // Sửa tại chỗ ngày thực tế (SC-5) — đặt sau quy tắc trạng thái nên giá trị gửi lên được giữ.
    if let Some(v) = patch.actual_start_at {
        next.actual_start_at = v;
    }
    if let Some(v) = patch.actual_end_at {
        next.actual_end_at = v;
    }
    validate::actual_range(next.actual_start_at, next.actual_end_at)?;

    let mut changes = diff(&mut tx, &cur, &next).await?;
    let mut touched = false;
    if let Some(drafts) = clean.subtasks {
        touched |= sync_subtasks(&mut tx, id, drafts).await?;
    }
    let mut removed = Vec::new();
    for aid in &patch.remove_attachment_ids {
        let Some(att) = repo::attachments::get_stored(&mut tx, *aid).await? else {
            continue;
        };
        if att.task_id != id {
            continue;
        }
        repo::attachments::delete(&mut tx, att.id).await?;
        changes.push(Change::new(
            HistoryField::AttachmentRemoved,
            Some(att.file_name),
            None,
        ));
        removed.push(att.stored_path);
    }
    attachment_service::insert_rows(&mut tx, id, copied, now).await?;
    changes.extend(attachment_service::added_changes(copied));
    if next != cur {
        repo::tasks::update_record(&mut tx, &next, now).await?;
    } else if touched || !changes.is_empty() {
        repo::tasks::touch(&mut tx, id, now).await?;
    }
    history::record(&mut tx, id, now, &changes).await?;
    tx.commit().await?;
    Ok(removed)
}

/// Đồng bộ việc con theo danh sách đầy đủ (không ghi lịch sử). Trả `true` nếu có thay đổi.
async fn sync_subtasks(
    conn: &mut SqliteConnection,
    task_id: Id,
    drafts: Vec<(Option<Id>, String)>,
) -> AppResult<bool> {
    let existing = repo::subtasks::list_for_task(conn, task_id).await?;
    let mut kept: HashSet<Id> = HashSet::new();
    let plan: Vec<(Option<Id>, String)> = drafts
        .into_iter()
        .map(|(sid, title)| {
            let sid = sid.filter(|s| existing.iter().any(|e| e.id == *s) && kept.insert(*s));
            (sid, title)
        })
        .collect();
    let mut changed = false;
    for e in existing.iter().filter(|e| !kept.contains(&e.id)) {
        repo::subtasks::delete(conn, e.id).await?;
        changed = true;
    }
    for (i, (sid, title)) in plan.iter().enumerate() {
        let pos = position(i);
        match sid.and_then(|s| existing.iter().find(|e| e.id == s)) {
            Some(e) if e.title == *title && e.position == pos => {}
            Some(e) => {
                repo::subtasks::update(conn, e.id, title, e.is_done, pos).await?;
                changed = true;
            }
            None => {
                repo::subtasks::insert(conn, task_id, title, pos).await?;
                changed = true;
            }
        }
    }
    Ok(changed)
}

// ======================= Trạng thái · Xoá =======================

/// Dropdown SC-5 / kéo thẻ Kanban (docs/02 §5).
pub async fn set_task_status(
    pool: &SqlitePool,
    input: SetTaskStatusInput,
) -> AppResult<TaskDetail> {
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    let cur = load_record(&mut tx, input.id).await?;
    let note = match input.note {
        None if input.status == cur.status => cur.status_note.clone(),
        other => other,
    };
    let mut next = cur.clone();
    next.set_status_fields(apply_status_change(
        &cur.status_fields(),
        input.status,
        note.as_deref(),
        now,
    ));
    validate::actual_range(next.actual_start_at, next.actual_end_at)?;
    if next != cur {
        let changes = diff(&mut tx, &cur, &next).await?;
        repo::tasks::update_record(&mut tx, &next, now).await?;
        history::record(&mut tx, cur.id, now, &changes).await?;
    }
    tx.commit().await?;
    get_task(pool, input.id).await
}

/// Đặt `deleted_at = now`, lịch sử "deleted".
pub async fn delete_task(pool: &SqlitePool, id: Id) -> AppResult<()> {
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    if repo::tasks::move_to_trash(&mut tx, id, now).await? == 0 {
        return Err(task_not_found());
    }
    let change = Change::new(HistoryField::Deleted, None, None);
    history::record(&mut tx, id, now, &[change]).await?;
    tx.commit().await?;
    Ok(())
}

// ======================= Việc con =======================

/// Thêm cuối danh sách (position = max + 1). Không ghi lịch sử.
pub async fn add_subtask(pool: &SqlitePool, input: AddSubtaskInput) -> AppResult<Subtask> {
    let title = subtask_title_required(&input.title)?;
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    ensure_task(&mut tx, input.task_id).await?;
    let pos = repo::subtasks::next_position(&mut tx, input.task_id).await?;
    let id = repo::subtasks::insert(&mut tx, input.task_id, &title, pos).await?;
    repo::tasks::touch(&mut tx, input.task_id, now).await?;
    let sub = repo::subtasks::get(&mut tx, id)
        .await?
        .ok_or_else(subtask_not_found)?;
    tx.commit().await?;
    Ok(sub)
}

pub async fn update_subtask(pool: &SqlitePool, input: UpdateSubtaskInput) -> AppResult<Subtask> {
    let title = input
        .title
        .as_deref()
        .map(subtask_title_required)
        .transpose()?;
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    let cur = repo::subtasks::get(&mut tx, input.id)
        .await?
        .ok_or_else(subtask_not_found)?;
    let title = title.unwrap_or_else(|| cur.title.clone());
    let is_done = input.is_done.unwrap_or(cur.is_done);
    repo::subtasks::update(&mut tx, cur.id, &title, is_done, cur.position).await?;
    repo::tasks::touch(&mut tx, cur.task_id, now).await?;
    tx.commit().await?;
    Ok(Subtask {
        title,
        is_done,
        ..cur
    })
}

pub async fn delete_subtask(pool: &SqlitePool, id: Id) -> AppResult<()> {
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    let cur = repo::subtasks::get(&mut tx, id)
        .await?
        .ok_or_else(subtask_not_found)?;
    repo::subtasks::delete(&mut tx, id).await?;
    repo::tasks::touch(&mut tx, cur.task_id, now).await?;
    tx.commit().await?;
    Ok(())
}

// ======================= Bình luận =======================

/// Tác giả phải đang làm việc. Không ghi lịch sử.
pub async fn add_comment(pool: &SqlitePool, input: AddCommentInput) -> AppResult<Comment> {
    let body = validate::comment_body(&input.body)?;
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    ensure_task(&mut tx, input.task_id).await?;
    ensure_active_employee(
        &mut tx,
        input.author_id,
        "authorId",
        AUTHOR_INACTIVE,
        AUTHOR_INACTIVE,
    )
    .await?;
    let id = repo::comments::insert(&mut tx, input.task_id, input.author_id, &body, now).await?;
    repo::tasks::touch(&mut tx, input.task_id, now).await?;
    let comment = repo::comments::get(&mut tx, id)
        .await?
        .ok_or_else(comment_not_found)?;
    tx.commit().await?;
    Ok(comment)
}

pub async fn delete_comment(pool: &SqlitePool, id: Id) -> AppResult<()> {
    let now = dates::now_ms();
    let mut tx = db::begin_write(pool).await?;
    let task_id = repo::comments::task_of(&mut tx, id)
        .await?
        .ok_or_else(comment_not_found)?;
    repo::comments::delete(&mut tx, id).await?;
    repo::tasks::touch(&mut tx, task_id, now).await?;
    tx.commit().await?;
    Ok(())
}

// ======================= Hỗ trợ =======================

/// Việc chưa xoá (việc trong Thùng rác không sửa được).
async fn load_record(conn: &mut SqliteConnection, id: Id) -> AppResult<TaskRecord> {
    repo::tasks::get_record(conn, id)
        .await?
        .filter(|r| r.deleted_at.is_none())
        .ok_or_else(task_not_found)
}

async fn ensure_task(conn: &mut SqliteConnection, id: Id) -> AppResult<()> {
    if repo::tasks::exists_active(conn, id).await? {
        Ok(())
    } else {
        Err(task_not_found())
    }
}

/// Nhân viên tồn tại và đang làm việc; trả họ tên.
async fn ensure_active_employee(
    conn: &mut SqliteConnection,
    id: Id,
    field: &str,
    missing: &str,
    inactive: &str,
) -> AppResult<String> {
    match repo::tasks::employee_brief(conn, id).await? {
        None => Err(AppError::validation(field, missing)),
        Some((_, EmployeeStatus::Inactive)) => Err(AppError::validation(field, inactive)),
        Some((name, EmployeeStatus::Active)) => Ok(name),
    }
}

/// Dòng lịch sử cho mỗi trường đổi (R-08, docs/02 §7), chữ hiển thị sẵn.
async fn diff(
    conn: &mut SqliteConnection,
    cur: &TaskRecord,
    next: &TaskRecord,
) -> AppResult<Vec<Change>> {
    let mut out = Vec::new();
    if cur.title != next.title {
        out.push(Change::new(
            HistoryField::Title,
            Some(cur.title.clone()),
            Some(next.title.clone()),
        ));
    }
    if cur.description != next.description {
        // UI hiện "Mô tả: đã sửa".
        out.push(Change::new(HistoryField::Description, None, None));
    }
    if cur.project_id != next.project_id {
        let old = repo::tasks::project_name(conn, cur.project_id).await?;
        let new = repo::tasks::project_name(conn, next.project_id).await?;
        out.push(Change::new(HistoryField::Project, old, new));
    }
    let old_status = status_with_note(cur.status, cur.status_note.as_deref());
    let new_status = status_with_note(next.status, next.status_note.as_deref());
    if old_status != new_status {
        out.push(Change::new(
            HistoryField::Status,
            Some(old_status),
            Some(new_status),
        ));
    }
    if cur.priority != next.priority {
        out.push(Change::new(
            HistoryField::Priority,
            Some(priority_label(cur.priority).to_string()),
            Some(priority_label(next.priority).to_string()),
        ));
    }
    if cur.assignee_id != next.assignee_id {
        let old = assignee_label(conn, cur.assignee_id).await?;
        let new = assignee_label(conn, next.assignee_id).await?;
        out.push(Change::new(HistoryField::Assignee, old, new));
    }
    if cur.creator_id != next.creator_id {
        let old = employee_name(conn, cur.creator_id).await?;
        let new = employee_name(conn, next.creator_id).await?;
        out.push(Change::new(HistoryField::Creator, old, new));
    }
    if cur.start_date != next.start_date {
        out.push(Change::new(
            HistoryField::StartDate,
            cur.start_date.as_deref().map(date_label),
            next.start_date.as_deref().map(date_label),
        ));
    }
    if cur.due_date != next.due_date {
        out.push(Change::new(
            HistoryField::DueDate,
            cur.due_date.as_deref().map(date_label),
            next.due_date.as_deref().map(date_label),
        ));
    }
    if cur.actual_start_at != next.actual_start_at {
        out.push(Change::new(
            HistoryField::ActualStart,
            cur.actual_start_at.map(datetime_label),
            next.actual_start_at.map(datetime_label),
        ));
    }
    if cur.actual_end_at != next.actual_end_at {
        out.push(Change::new(
            HistoryField::ActualEnd,
            cur.actual_end_at.map(datetime_label),
            next.actual_end_at.map(datetime_label),
        ));
    }
    Ok(out)
}

async fn employee_name(conn: &mut SqliteConnection, id: Id) -> AppResult<Option<String>> {
    Ok(repo::tasks::employee_brief(conn, id)
        .await?
        .map(|(name, _)| name))
}

/// Người phụ trách trống ghi "Chưa giao" (thống nhất với R-04 của B1).
async fn assignee_label(conn: &mut SqliteConnection, id: Option<Id>) -> AppResult<Option<String>> {
    match id {
        None => Ok(Some(labels::UNASSIGNED.to_string())),
        Some(id) => employee_name(conn, id).await,
    }
}

/// Mô tả chỉ có khoảng trắng → trống. Giữ nguyên định dạng nhiều dòng.
fn clean_description(d: Option<&str>) -> Option<String> {
    d.filter(|s| !s.trim().is_empty()).map(str::to_string)
}

/// Bỏ dòng trống, kiểm tra ≤ 500 ký tự.
fn clean_subtask_titles<'a>(titles: impl Iterator<Item = &'a str>) -> AppResult<Vec<String>> {
    let mut out = Vec::new();
    for t in titles {
        if let Some(t) = validate::subtask_title(t)? {
            out.push(t);
        }
    }
    Ok(out)
}

fn subtask_title_required(v: &str) -> AppResult<String> {
    match validate::subtask_title(v) {
        Ok(Some(t)) => Ok(t),
        Ok(None) => Err(AppError::validation("title", SUBTASK_EMPTY)),
        Err(mut e) => {
            e.field = Some("title".to_string());
            Err(e)
        }
    }
}

fn position(i: usize) -> i64 {
    i64::try_from(i).unwrap_or(i64::MAX - 1) + 1
}
