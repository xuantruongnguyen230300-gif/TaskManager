//! CHỈ BẢN DEBUG (module bị `#[cfg(debug_assertions)]` ở services/mod.rs). Chủ: B1.
//! Nạp dữ liệu mẫu giống prototype (design/Main.dc.html): 7 nhân viên (người 1 là "Tôi" — cập nhật
//! hồ sơ id 1, người 7 Đã nghỉ), dự án VC/WEB/APP/MKT/NB, 19 việc, vài bình luận, việc con.
//! Ngày tính tương đối: prototype lấy "hôm nay" = 12/09/2026, ở đây dời theo hôm nay thật.
//! Chạy lại được: nếu đã có dự án khác VC thì báo đã có, không nạp nữa.

use chrono::{Days, Local, NaiveDate, TimeZone};
use sqlx::{SqliteConnection, SqlitePool};

use crate::db;
use crate::domain::dates::iso;
use crate::dto::{HistoryField, Id};
use crate::error::{AppError, AppResult};
use crate::repo;
use crate::repo::employees::EmployeeData;

/// (họ tên, chức danh, email, điện thoại, màu, đang làm việc)
const EMPLOYEES: [(&str, &str, &str, &str, &str, bool); 7] = [
    (
        "Trần Minh Quân",
        "Trưởng nhóm",
        "quan.tran@example.com",
        "0901 000 001",
        "#6E56CF",
        true,
    ),
    (
        "Lê Thu Hà",
        "Lập trình viên frontend",
        "ha.le@example.com",
        "0901 000 002",
        "#2F80ED",
        true,
    ),
    (
        "Phạm Đức Anh",
        "Lập trình viên backend",
        "anh.pham@example.com",
        "0901 000 003",
        "#D9622B",
        true,
    ),
    (
        "Nguyễn Ngọc Lan",
        "Nhà thiết kế UI/UX",
        "lan.nguyen@example.com",
        "0901 000 004",
        "#C2527A",
        true,
    ),
    (
        "Võ Hoàng Nam",
        "Kiểm thử phần mềm",
        "nam.vo@example.com",
        "0901 000 005",
        "#2E8B57",
        true,
    ),
    (
        "Đặng Mai Phương",
        "Chuyên viên kinh doanh",
        "phuong.dang@example.com",
        "0901 000 006",
        "#B7791F",
        true,
    ),
    (
        "Bùi Quốc Việt",
        "Lập trình viên",
        "viet.bui@example.com",
        "0901 000 007",
        "#5F6B7A",
        false,
    ),
];

/// (mã, tên, màu, next_task_no). VC đã có sẵn (id 1).
const PROJECTS: [(&str, &str, &str, i64); 5] = [
    ("VC", "Việc chung", "#8C7AE6", 2),
    ("WEB", "Website công ty", "#5B8DEF", 16),
    ("APP", "Ứng dụng đặt lịch", "#4DBB7F", 10),
    ("MKT", "Chiến dịch tháng 10", "#F28B6E", 5),
    ("NB", "Nội bộ", "#E5B93A", 7),
];

struct SeedTask {
    code: &'static str,
    /// Chỉ số trong PROJECTS.
    project: usize,
    title: &'static str,
    desc: &'static str,
    status: &'static str,
    note: &'static str,
    priority: i64,
    /// Số thứ tự nhân viên trong prototype (1..7), 0 = Chưa giao.
    assignee: usize,
    creator: usize,
    /// Ngày trong tháng 9 của prototype, 0 = trống.
    start: u32,
    due: u32,
    /// "dd/MM HH:mm" của prototype, "" = trống.
    actual_start: &'static str,
    actual_end: &'static str,
    created: &'static str,
    updated: &'static str,
    subtasks: &'static [(&'static str, bool)],
}

const TASKS: [SeedTask; 19] = [
    SeedTask { code: "WEB-12", project: 1, title: "Hoàn thiện giao diện trang chủ", desc: "Hoàn thiện trang chủ theo bản thiết kế v2: header, banner có video nền, khối dịch vụ, footer. Chạy tốt trên Chrome, Edge, Safari.", status: "in_progress", note: "", priority: 3, assignee: 2, creator: 1, start: 8, due: 15, actual_start: "08/09 09:10", actual_end: "", created: "05/09 14:20", updated: "12/09 08:20", subtasks: &[("Header và menu", true), ("Banner có video nền", false), ("Khối dịch vụ", true), ("Footer", false)] },
    SeedTask { code: "WEB-13", project: 1, title: "Tích hợp form liên hệ với email", desc: "Form gửi email về hộp thư kinh doanh, có chống spam.", status: "new", note: "", priority: 2, assignee: 3, creator: 1, start: 14, due: 18, actual_start: "", actual_end: "", created: "07/09 09:00", updated: "10/09 09:00", subtasks: &[] },
    SeedTask { code: "WEB-14", project: 1, title: "Duyệt logo mới với khách hàng", desc: "", status: "waiting", note: "Chờ khách phản hồi 3 phương án gửi ngày 11/09", priority: 2, assignee: 4, creator: 6, start: 9, due: 16, actual_start: "09/09 14:00", actual_end: "", created: "08/09 11:30", updated: "11/09 14:30", subtasks: &[] },
    SeedTask { code: "WEB-15", project: 1, title: "Kiểm thử trên trình duyệt Safari", desc: "", status: "new", note: "", priority: 2, assignee: 5, creator: 1, start: 0, due: 19, actual_start: "", actual_end: "", created: "11/09 16:05", updated: "11/09 16:05", subtasks: &[] },
    SeedTask { code: "WEB-9", project: 1, title: "Tối ưu tốc độ tải trang", desc: "", status: "new", note: "", priority: 2, assignee: 0, creator: 1, start: 0, due: 20, actual_start: "", actual_end: "", created: "28/08 15:40", updated: "28/08 15:40", subtasks: &[] },
    SeedTask { code: "WEB-10", project: 1, title: "Dựng khung trang chủ", desc: "", status: "done", note: "", priority: 3, assignee: 2, creator: 1, start: 1, due: 5, actual_start: "01/09 08:30", actual_end: "04/09 17:45", created: "29/08 10:00", updated: "04/09 17:45", subtasks: &[] },
    SeedTask { code: "WEB-11", project: 1, title: "Viết nội dung trang Giới thiệu", desc: "", status: "cancelled", note: "Khách tự cung cấp nội dung", priority: 1, assignee: 6, creator: 1, start: 0, due: 10, actual_start: "", actual_end: "", created: "02/09 09:15", updated: "07/09 10:00", subtasks: &[] },
    SeedTask { code: "APP-7", project: 2, title: "Thiết kế luồng đặt lịch khám", desc: "", status: "in_progress", note: "", priority: 3, assignee: 4, creator: 1, start: 9, due: 13, actual_start: "09/09 08:45", actual_end: "", created: "04/09 10:20", updated: "10/09 15:20", subtasks: &[("Luồng chọn bác sĩ", true), ("Luồng chọn giờ", false), ("Màn xác nhận", false)] },
    SeedTask { code: "APP-8", project: 2, title: "Xây dựng API tạo lịch hẹn", desc: "API REST tạo, sửa, huỷ lịch hẹn; kiểm tra trùng lịch bác sĩ.", status: "in_progress", note: "", priority: 4, assignee: 3, creator: 1, start: 7, due: 11, actual_start: "07/09 13:30", actual_end: "", created: "05/09 09:00", updated: "12/09 08:05", subtasks: &[("Tạo lịch hẹn", true), ("Kiểm tra trùng lịch", false)] },
    SeedTask { code: "APP-9", project: 2, title: "Viết test cho API lịch hẹn", desc: "", status: "new", note: "", priority: 3, assignee: 5, creator: 3, start: 0, due: 17, actual_start: "", actual_end: "", created: "11/09 10:30", updated: "11/09 10:30", subtasks: &[] },
    SeedTask { code: "APP-6", project: 2, title: "Chốt yêu cầu với khách hàng", desc: "", status: "done", note: "", priority: 3, assignee: 1, creator: 1, start: 3, due: 6, actual_start: "03/09 09:00", actual_end: "08/09 11:00", created: "01/09 08:00", updated: "08/09 11:00", subtasks: &[] },
    SeedTask { code: "MKT-3", project: 3, title: "Lên kế hoạch nội dung tháng 10", desc: "", status: "in_progress", note: "", priority: 2, assignee: 6, creator: 1, start: 10, due: 20, actual_start: "10/09 09:30", actual_end: "", created: "09/09 15:00", updated: "10/09 09:30", subtasks: &[] },
    SeedTask { code: "MKT-4", project: 3, title: "Thiết kế banner quảng cáo Facebook", desc: "", status: "new", note: "", priority: 2, assignee: 4, creator: 6, start: 0, due: 22, actual_start: "", actual_end: "", created: "11/09 11:00", updated: "11/09 11:00", subtasks: &[] },
    SeedTask { code: "MKT-2", project: 3, title: "Báo giá quảng cáo cho khách Minh Phát", desc: "", status: "waiting", note: "Chờ giám đốc duyệt ngân sách", priority: 3, assignee: 6, creator: 1, start: 9, due: 12, actual_start: "10/09 14:00", actual_end: "", created: "09/09 09:40", updated: "11/09 09:15", subtasks: &[] },
    SeedTask { code: "NB-5", project: 4, title: "Đánh giá hiệu suất quý 3", desc: "", status: "new", note: "", priority: 3, assignee: 1, creator: 1, start: 21, due: 30, actual_start: "", actual_end: "", created: "03/09 14:30", updated: "03/09 14:30", subtasks: &[] },
    SeedTask { code: "NB-4", project: 4, title: "Gia hạn bản quyền phần mềm thiết kế", desc: "", status: "new", note: "", priority: 4, assignee: 1, creator: 4, start: 0, due: 10, actual_start: "", actual_end: "", created: "03/09 10:00", updated: "03/09 10:00", subtasks: &[] },
    SeedTask { code: "NB-3", project: 4, title: "Bàn giao thiết bị của Việt", desc: "", status: "done", note: "", priority: 2, assignee: 5, creator: 1, start: 0, due: 2, actual_start: "01/09 09:00", actual_end: "01/09 16:30", created: "29/08 17:00", updated: "01/09 16:30", subtasks: &[] },
    SeedTask { code: "NB-6", project: 4, title: "Đặt phòng họp cho buổi review sprint", desc: "", status: "new", note: "", priority: 2, assignee: 0, creator: 1, start: 0, due: 15, actual_start: "", actual_end: "", created: "12/09 07:50", updated: "12/09 07:50", subtasks: &[] },
    SeedTask { code: "VC-1", project: 0, title: "Chuẩn bị tài liệu họp giao ban tuần", desc: "", status: "new", note: "", priority: 2, assignee: 1, creator: 1, start: 0, due: 14, actual_start: "", actual_end: "", created: "11/09 17:30", updated: "11/09 17:30", subtasks: &[] },
];

/// (mã việc, tác giả 1..7, "dd/MM HH:mm", nội dung)
const COMMENTS: [(&str, usize, &str, &str); 6] = [
    (
        "WEB-12",
        2,
        "09/09 17:05",
        "Đã dựng xong header và menu, đang làm phần banner.",
    ),
    (
        "WEB-12",
        1,
        "10/09 16:30",
        "Khách muốn banner có video nền, cần ước lượng lại thời gian.",
    ),
    (
        "WEB-12",
        2,
        "11/09 10:12",
        "Ước lượng thêm 4 giờ cho phần video nền.",
    ),
    (
        "APP-8",
        3,
        "11/09 18:10",
        "Còn thiếu phần kiểm tra trùng lịch, cần thêm 1 ngày.",
    ),
    (
        "APP-8",
        1,
        "12/09 08:05",
        "Đã báo khách lùi buổi demo sang thứ Hai 14/09.",
    ),
    (
        "APP-7",
        4,
        "10/09 15:20",
        "Xong luồng chọn bác sĩ, còn luồng chọn giờ và màn xác nhận.",
    ),
];

/// Dời ngày của prototype (tháng 8–9/2026, "hôm nay" = 12/09) sang quanh hôm nay thật.
struct Shift {
    base: NaiveDate,
    today: NaiveDate,
}

impl Shift {
    fn date(&self, month: u32, day: u32) -> AppResult<NaiveDate> {
        let d = NaiveDate::from_ymd_opt(2026, month, day)
            .ok_or_else(|| AppError::internal("Ngày mẫu không hợp lệ."))?;
        let offset = (d - self.base).num_days();
        let shifted = if offset >= 0 {
            self.today
                .checked_add_days(Days::new(offset.unsigned_abs()))
        } else {
            self.today
                .checked_sub_days(Days::new(offset.unsigned_abs()))
        };
        shifted.ok_or_else(|| AppError::internal("Ngày mẫu không hợp lệ."))
    }

    /// Ngày trong tháng 9 → "YYYY-MM-DD"; 0 → None.
    fn day(&self, day: u32) -> AppResult<Option<String>> {
        if day == 0 {
            return Ok(None);
        }
        Ok(Some(iso(self.date(9, day)?)))
    }

    /// "dd/MM HH:mm" → ms UTC theo giờ máy; "" → None.
    fn at(&self, s: &str) -> AppResult<Option<i64>> {
        if s.is_empty() {
            return Ok(None);
        }
        let bad = || AppError::internal("Thời điểm mẫu không hợp lệ.");
        let num = |r: std::ops::Range<usize>| -> AppResult<u32> {
            s.get(r).and_then(|v| v.parse().ok()).ok_or_else(bad)
        };
        let (day, month, hour, min) = (num(0..2)?, num(3..5)?, num(6..8)?, num(9..11)?);
        let naive = self
            .date(month, day)?
            .and_hms_opt(hour, min, 0)
            .ok_or_else(bad)?;
        let dt = Local
            .from_local_datetime(&naive)
            .earliest()
            .ok_or_else(bad)?;
        Ok(Some(dt.timestamp_millis()))
    }

    fn at_req(&self, s: &str) -> AppResult<i64> {
        self.at(s)?
            .ok_or_else(|| AppError::internal("Thiếu thời điểm mẫu."))
    }
}

fn opt(s: &str) -> Option<&str> {
    (!s.is_empty()).then_some(s)
}

pub async fn seed_sample_data(pool: &SqlitePool) -> AppResult<()> {
    let base = NaiveDate::from_ymd_opt(2026, 9, 12)
        .ok_or_else(|| AppError::internal("Ngày mẫu không hợp lệ."))?;
    let shift = Shift {
        base,
        today: Local::now().date_naive(),
    };
    let mut tx = db::begin_write(pool).await?;
    let has_other: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM projects WHERE id <> 1)")
            .fetch_one(&mut *tx)
            .await?;
    if has_other {
        return Err(AppError::internal(
            "Đã có dữ liệu (có dự án ngoài Việc chung) nên không nạp dữ liệu mẫu.",
        ));
    }
    let now = shift.at_req("12/09 10:00")?;
    let emp_ids = seed_employees(&mut tx, now).await?;
    let project_ids = seed_projects(&mut tx, now).await?;
    let mut task_ids: Vec<(&str, Id)> = Vec::new();
    for t in &TASKS {
        let id = seed_task(&mut tx, &shift, t, &emp_ids, &project_ids).await?;
        task_ids.push((t.code, id));
    }
    for (code, author, at, body) in COMMENTS {
        let Some((_, task_id)) = task_ids.iter().find(|(c, _)| *c == code) else {
            continue;
        };
        let at = shift.at_req(at)?;
        sqlx::query(
            "INSERT INTO task_comments (task_id, author_id, body, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(task_id)
        .bind(emp_ids[author - 1])
        .bind(body)
        .bind(at)
        .bind(at)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    tracing::info!(tasks = TASKS.len(), "đã nạp dữ liệu mẫu");
    Ok(())
}

/// Người 1 = cập nhật hồ sơ "Tôi" (id 1); người 7 Đã nghỉ. Trả id theo thứ tự prototype.
async fn seed_employees(conn: &mut SqliteConnection, now: i64) -> AppResult<Vec<Id>> {
    let self_id = repo::employees::self_id(conn).await?;
    let mut ids = Vec::with_capacity(EMPLOYEES.len());
    for (i, (name, title, email, phone, color, active)) in EMPLOYEES.into_iter().enumerate() {
        let data = EmployeeData {
            full_name: name.to_string(),
            title: Some(title.to_string()),
            phone: Some(phone.to_string()),
            email: Some(email.to_string()),
            color: color.to_string(),
        };
        if i == 0 {
            repo::employees::update(conn, self_id, &data, now).await?;
            ids.push(self_id);
        } else {
            let status = if active { "active" } else { "inactive" };
            ids.push(repo::employees::insert(conn, &data, status, now).await?);
        }
    }
    Ok(ids)
}

async fn seed_projects(conn: &mut SqliteConnection, now: i64) -> AppResult<Vec<Id>> {
    let mut ids = Vec::with_capacity(PROJECTS.len());
    for (code, name, color, next_no) in PROJECTS {
        if code == "VC" {
            sqlx::query(
                "UPDATE projects SET color = ?, next_task_no = MAX(next_task_no, ?), updated_at = ?
                 WHERE id = 1",
            )
            .bind(color)
            .bind(next_no)
            .bind(now)
            .execute(&mut *conn)
            .await?;
            ids.push(1);
        } else {
            ids.push(repo::projects::insert(conn, code, name, color, next_no, now).await?);
        }
    }
    Ok(ids)
}

async fn seed_task(
    conn: &mut SqliteConnection,
    shift: &Shift,
    t: &SeedTask,
    emp_ids: &[Id],
    project_ids: &[Id],
) -> AppResult<Id> {
    let created = shift.at_req(t.created)?;
    let updated = shift.at_req(t.updated)?;
    let assignee = (t.assignee > 0).then(|| emp_ids[t.assignee - 1]);
    let id: Id = sqlx::query_scalar(
        "INSERT INTO tasks (code, project_id, title, description, status, status_note, priority,
                            assignee_id, creator_id, start_date, due_date, actual_start_at,
                            actual_end_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(t.code)
    .bind(project_ids[t.project])
    .bind(t.title)
    .bind(opt(t.desc))
    .bind(t.status)
    .bind(opt(t.note))
    .bind(t.priority)
    .bind(assignee)
    .bind(emp_ids[t.creator - 1])
    .bind(shift.day(t.start)?)
    .bind(shift.day(t.due)?)
    .bind(shift.at(t.actual_start)?)
    .bind(shift.at(t.actual_end)?)
    .bind(created)
    .bind(updated)
    .fetch_one(&mut *conn)
    .await?;
    for (pos, (title, done)) in t.subtasks.iter().enumerate() {
        sqlx::query("INSERT INTO subtasks (task_id, title, is_done, position) VALUES (?, ?, ?, ?)")
            .bind(id)
            .bind(*title)
            .bind(*done)
            .bind(i64::try_from(pos).unwrap_or(0) + 1)
            .execute(&mut *conn)
            .await?;
    }
    repo::history::insert(conn, id, created, HistoryField::Created, None, Some(t.code)).await?;
    Ok(id)
}
