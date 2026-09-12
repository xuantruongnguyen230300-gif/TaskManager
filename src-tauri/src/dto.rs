//! HỢP ĐỒNG IPC (viết tay). Mỗi kiểu ở đây có kiểu TS tương ứng ở `src/shared/api/types.ts`.
//! Đổi một kiểu thì sửa CẢ HAI file trong cùng thay đổi.
//!
//! Quy ước: `#[serde(rename_all = "camelCase")]`; thời điểm = ms UTC (`i64`, TS `number`);
//! ngày lịch = "YYYY-MM-DD" (`String`, TS `string`); `Option<T>` → TS `T | null`
//! (field input kiểu `Option` được phép bỏ trống).
//! Patch: `Option<Option<T>>` + `double_option` → TS `field?: T | null`
//! (không gửi = giữ nguyên, `null` = xoá giá trị, có giá trị = đặt).

use serde::{Deserialize, Deserializer, Serialize};

pub use crate::domain::labels::HistoryField;
pub use crate::domain::status::TaskStatus;

pub type Id = i64;

/// Phân biệt "không gửi" (None) với "gửi null" (Some(None)). Dùng cùng `#[serde(default)]`.
pub fn double_option<'de, T, D>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(de).map(Some)
}

// ======================= Nhân viên =======================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum EmployeeStatus {
    Active,
    Inactive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EmployeeStatusFilter {
    Active,
    Inactive,
    All,
}

/// Dòng bảng Nhân viên (SC-6) — cũng dùng cho dropdown chọn người.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeRow {
    pub id: Id,
    pub full_name: String,
    pub title: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub color: String,
    pub is_self: bool,
    pub status: EmployeeStatus,
    /// Số việc đang mở (Mới/Đang làm/Đang chờ, chưa xoá) mà người này phụ trách.
    pub open_count: i64,
    pub overdue_count: i64,
}

/// Chi tiết nhân viên (SC-7): thông tin + 3 số.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeDetail {
    pub id: Id,
    pub full_name: String,
    pub title: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub color: String,
    pub is_self: bool,
    pub status: EmployeeStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub open_count: i64,
    pub overdue_count: i64,
    /// Hoàn thành 30 ngày: phụ trách, Hoàn thành, Kết thúc thực tế ≥ bây giờ − 30 ngày.
    pub done_30d_count: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEmployeesInput {
    pub status: EmployeeStatusFilter,
    /// Tìm theo tên, không phân biệt hoa thường và dấu.
    pub q: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEmployeeInput {
    pub full_name: String,
    pub title: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub color: String,
}

/// Sửa nhân viên (kể cả hồ sơ "Tôi"): gửi đủ các trường của form.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEmployeeInput {
    pub id: Id,
    pub full_name: String,
    pub title: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub color: String,
}

/// R-04: chuyển Đã nghỉ, giao lại mọi việc chưa xong cho `reassign_to` (None = "Chưa giao").
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeactivateEmployeeInput {
    pub id: Id,
    pub reassign_to: Option<Id>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeactivateResult {
    /// Số việc đã giao lại (dùng cho toast "Đã giao lại {k} việc.").
    pub reassigned_count: i64,
}

// ======================= Dự án =======================

/// Dự án kèm tiến độ (sidebar, đầu trang SC-3, dropdown dự án).
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: Id,
    pub code: String,
    pub name: String,
    pub color: String,
    /// x: số việc Hoàn thành (chưa xoá).
    pub done_count: i64,
    /// y: tổng số việc chưa xoá − số việc Đã huỷ. y = 0 → UI hiện "—".
    pub progress_total: i64,
    /// Có ít nhất một việc, KỂ CẢ trong Thùng rác → khoá ô Mã, chặn xoá dự án.
    pub has_tasks: bool,
    /// Dự án "Việc chung" (id = 1): không xoá được.
    pub is_default: bool,
    /// Số của mã việc kế tiếp (`projects.next_task_no`) → form SC-4 hiện "Mã dự kiến".
    /// Truy vấn chưa chọn cột này thì = 0 (UI ẩn mã dự kiến).
    #[sqlx(default)]
    pub next_task_no: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub code: String,
    pub color: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectInput {
    pub id: Id,
    pub name: String,
    /// Chỉ đổi được khi dự án chưa có việc nào (kể cả Thùng rác).
    pub code: String,
    pub color: String,
}

// ======================= Việc =======================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub enum UnassignedTag {
    #[serde(rename = "unassigned")]
    Unassigned,
}

/// Bộ lọc người phụ trách: id nhân viên hoặc chuỗi "unassigned" (Chưa giao).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(untagged)]
pub enum AssigneeFilter {
    Id(Id),
    Unassigned(UnassignedTag),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DueFilter {
    /// Đang mở và hạn chót < hôm nay.
    Overdue,
    /// Hạn chót từ thứ Hai đến Chủ nhật tuần này.
    ThisWeek,
    /// Không có hạn chót.
    NoDue,
}

/// Bộ lọc `list_tasks`. Mọi trường bỏ trống = không lọc, riêng `statuses` bỏ trống =
/// mặc định Mới + Đang làm + Đang chờ. Kết quả sắp `created_at DESC`; chỉ việc chưa xoá.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskFilter {
    pub project_id: Option<Id>,
    pub assignee: Option<AssigneeFilter>,
    pub statuses: Option<Vec<TaskStatus>>,
    pub due: Option<DueFilter>,
    /// Tìm theo mã hoặc tiêu đề, không dấu (R-11), lọc trong Rust bằng `fold_vi`.
    pub q: Option<String>,
}

/// Một việc trong bảng/thẻ Kanban/danh sách "Cần chú ý".
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TaskRow {
    pub id: Id,
    pub code: String,
    pub title: String,
    pub project_id: Id,
    pub project_code: String,
    pub project_name: String,
    pub project_color: String,
    pub assignee_id: Option<Id>,
    pub assignee_name: Option<String>,
    pub assignee_color: Option<String>,
    /// Người phụ trách đã nghỉ → UI hiện nhãn "Đã nghỉ".
    pub assignee_inactive: bool,
    pub creator_id: Id,
    pub creator_name: String,
    pub status: TaskStatus,
    /// 1 Thấp · 2 Trung bình · 3 Cao · 4 Khẩn cấp.
    pub priority: i64,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub created_at: i64,
    /// Kết thúc thực tế (ms), dùng ở SC-7 tab Đã hoàn thành.
    pub actual_end_at: Option<i64>,
    pub subtask_done: i64,
    pub subtask_total: i64,
    pub comment_count: i64,
    pub attachment_count: i64,
}

/// Thông tin một việc (phần phẳng của `TaskDetail`).
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TaskInfo {
    pub id: Id,
    pub code: String,
    pub project_id: Id,
    pub project_code: String,
    pub project_name: String,
    pub project_color: String,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    /// Lý do chờ/huỷ (chỉ có khi status là waiting/cancelled).
    pub status_note: Option<String>,
    pub priority: i64,
    pub assignee_id: Option<Id>,
    pub assignee_name: Option<String>,
    pub assignee_color: Option<String>,
    pub assignee_inactive: bool,
    pub creator_id: Id,
    pub creator_name: String,
    pub creator_color: String,
    pub creator_inactive: bool,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub actual_start_at: Option<i64>,
    pub actual_end_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Subtask {
    pub id: Id,
    pub task_id: Id,
    pub title: String,
    pub is_done: bool,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: Id,
    pub task_id: Id,
    pub author_id: Id,
    pub author_name: String,
    pub author_color: String,
    pub author_inactive: bool,
    pub body: String,
    pub created_at: i64,
}

/// Tệp đính kèm. Không lộ `stored_path` ra UI.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: Id,
    pub task_id: Id,
    pub file_name: String,
    pub size_bytes: i64,
    pub created_at: i64,
}

/// Một dòng lịch sử. `old_value`/`new_value` là chữ hiển thị sẵn; NULL → UI hiện "(trống)".
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: Id,
    pub changed_at: i64,
    pub field: HistoryField,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
}

/// Chi tiết việc (SC-5). JSON phẳng: các trường của `TaskInfo` + 4 danh sách.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDetail {
    #[serde(flatten)]
    pub task: TaskInfo,
    /// Theo `position` tăng dần.
    pub subtasks: Vec<Subtask>,
    /// Cũ nhất trước (mới nhất ở cuối).
    pub comments: Vec<Comment>,
    pub attachments: Vec<Attachment>,
    /// Mới nhất trước.
    pub history: Vec<HistoryEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub project_id: Id,
    pub title: String,
    pub description: Option<String>,
    pub assignee_id: Option<Id>,
    pub creator_id: Id,
    pub status: TaskStatus,
    pub status_note: Option<String>,
    pub priority: i64,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    /// Tiêu đề các việc con theo thứ tự; dòng trống bị bỏ.
    #[serde(default)]
    pub subtasks: Vec<String>,
    /// Đường dẫn tuyệt đối lấy từ `pick_files`.
    #[serde(default)]
    pub file_paths: Vec<String>,
}

/// Một dòng việc con trong form sửa: `id` có = dòng cũ (giữ trạng thái tick), không có = dòng mới.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtaskDraft {
    pub id: Option<Id>,
    pub title: String,
}

/// Các trường thay đổi của việc. Trường không gửi = giữ nguyên.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPatch {
    pub project_id: Option<Id>,
    pub title: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    pub description: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub assignee_id: Option<Option<Id>>,
    pub creator_id: Option<Id>,
    pub status: Option<TaskStatus>,
    #[serde(default, deserialize_with = "double_option")]
    pub status_note: Option<Option<String>>,
    pub priority: Option<i64>,
    #[serde(default, deserialize_with = "double_option")]
    pub start_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub due_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    pub actual_start_at: Option<Option<i64>>,
    #[serde(default, deserialize_with = "double_option")]
    pub actual_end_at: Option<Option<i64>>,
    /// Danh sách việc con ĐẦY ĐỦ theo thứ tự mới (không gửi = giữ nguyên).
    pub subtasks: Option<Vec<SubtaskDraft>>,
    #[serde(default)]
    pub add_file_paths: Vec<String>,
    #[serde(default)]
    pub remove_attachment_ids: Vec<Id>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub id: Id,
    pub patch: TaskPatch,
}

/// Đổi trạng thái từ dropdown SC-5 hoặc kéo thẻ Kanban. `note` = lý do chờ/huỷ.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTaskStatusInput {
    pub id: Id,
    pub status: TaskStatus,
    pub note: Option<String>,
}

// ======================= Việc con · Bình luận · Tệp =======================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddSubtaskInput {
    pub task_id: Id,
    pub title: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubtaskInput {
    pub id: Id,
    pub title: Option<String>,
    pub is_done: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCommentInput {
    pub task_id: Id,
    pub author_id: Id,
    pub body: String,
}

/// Tệp người dùng vừa chọn trong hộp thoại (chưa chép vào thư mục dữ liệu).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedFile {
    pub path: String,
    pub file_name: String,
    pub size_bytes: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddAttachmentsInput {
    pub task_id: Id,
    pub file_paths: Vec<String>,
}

// ======================= Tổng quan =======================

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeWorkload {
    pub id: Id,
    pub full_name: String,
    pub color: String,
    pub is_self: bool,
    pub open_count: i64,
    pub overdue_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub open_count: i64,
    pub overdue_count: i64,
    pub waiting_count: i64,
    pub done_this_week_count: i64,
    /// Đang mở và hạn chót ≤ ngày mai, sắp theo hạn chót tăng dần.
    pub attention: Vec<TaskRow>,
    /// Nhân viên đang làm việc, sắp số việc đang mở giảm dần.
    pub by_employee: Vec<EmployeeWorkload>,
}

// ======================= Thùng rác =======================

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TrashRow {
    pub id: Id,
    pub code: String,
    pub title: String,
    pub project_id: Id,
    pub project_code: String,
    pub project_name: String,
    pub project_color: String,
    pub deleted_at: i64,
    /// "Còn N ngày" = 30 − số ngày đã qua kể từ lúc xoá.
    pub days_left: i64,
}

// ======================= Cài đặt · Dữ liệu =======================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: Theme,
    /// Đường dẫn thư mục dữ liệu (hiển thị ở SC-9).
    pub data_dir: String,
    pub self_employee_id: Id,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsInput {
    pub theme: Theme,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub path: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_patch_distinguishes_missing_and_null() {
        let p: TaskPatch =
            serde_json::from_str(r#"{"title":"A","dueDate":null,"assigneeId":3}"#).unwrap();
        assert_eq!(p.title.as_deref(), Some("A"));
        assert_eq!(p.due_date, Some(None));
        assert_eq!(p.assignee_id, Some(Some(3)));
        assert_eq!(p.start_date, None);
        assert!(p.add_file_paths.is_empty());
    }

    #[test]
    fn task_filter_parses_assignee_and_due() {
        let f: TaskFilter = serde_json::from_str(
            r#"{"assignee":"unassigned","due":"thisWeek","statuses":["new","done"]}"#,
        )
        .unwrap();
        assert_eq!(
            f.assignee,
            Some(AssigneeFilter::Unassigned(UnassignedTag::Unassigned))
        );
        assert_eq!(f.due, Some(DueFilter::ThisWeek));
        assert_eq!(f.statuses, Some(vec![TaskStatus::New, TaskStatus::Done]));
        let f: TaskFilter = serde_json::from_str(r#"{"assignee":7}"#).unwrap();
        assert_eq!(f.assignee, Some(AssigneeFilter::Id(7)));
        let f: TaskFilter = serde_json::from_str("{}").unwrap();
        assert!(f.statuses.is_none());
    }
}
