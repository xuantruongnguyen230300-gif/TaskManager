//! Ngày giờ theo giờ máy. Thời điểm = ms UTC (i64); ngày lịch = "YYYY-MM-DD". Tuần bắt đầu thứ Hai.

use chrono::{DateTime, Datelike, Days, Local, NaiveDate, TimeZone, Utc};

pub const DAY_MS: i64 = 86_400_000;
/// Thùng rác giữ 30 ngày (R-07).
pub const TRASH_RETENTION_DAYS: i64 = 30;
pub const TRASH_RETENTION_MS: i64 = TRASH_RETENTION_DAYS * DAY_MS;

pub fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// Các mốc thời gian dùng làm tham số truy vấn (`:now`, `:today`, `:week_start`… ở docs/03 §2).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Clock {
    pub now_ms: i64,
    /// Hôm nay "YYYY-MM-DD".
    pub today: String,
    pub tomorrow: String,
    /// Thứ Hai tuần này "YYYY-MM-DD".
    pub monday: String,
    /// Chủ nhật tuần này "YYYY-MM-DD".
    pub sunday: String,
    /// 00:00 thứ Hai tuần này (ms UTC).
    pub week_start_ms: i64,
    /// 00:00 thứ Hai tuần sau (ms UTC).
    pub next_week_start_ms: i64,
}

impl Clock {
    pub fn now() -> Self {
        Self::at(Local::now())
    }

    pub fn at<Tz: TimeZone>(now: DateTime<Tz>) -> Self {
        let tz = now.timezone();
        let today = now.date_naive();
        let monday = week_monday(today);
        let sunday = monday + Days::new(6);
        let next_monday = monday + Days::new(7);
        Self {
            now_ms: now.timestamp_millis(),
            today: iso(today),
            tomorrow: iso(today + Days::new(1)),
            monday: iso(monday),
            sunday: iso(sunday),
            week_start_ms: midnight_ms(&tz, monday),
            next_week_start_ms: midnight_ms(&tz, next_monday),
        }
    }
}

/// Thứ Hai của tuần chứa `d`.
pub fn week_monday(d: NaiveDate) -> NaiveDate {
    d - Days::new(u64::from(d.weekday().num_days_from_monday()))
}

pub fn iso(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

/// Đọc ngày "YYYY-MM-DD" (chặt: đúng 10 ký tự).
pub fn parse_iso(s: &str) -> Option<NaiveDate> {
    if s.len() != 10 {
        return None;
    }
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

/// 00:00 giờ địa phương của ngày `d`, đổi ra ms UTC.
pub fn midnight_ms<Tz: TimeZone>(tz: &Tz, d: NaiveDate) -> i64 {
    let naive = d.and_hms_opt(0, 0, 0).unwrap_or_default();
    tz.from_local_datetime(&naive)
        .earliest()
        .map(|dt| dt.timestamp_millis())
        .unwrap_or_else(|| naive.and_utc().timestamp_millis())
}

/// Số ngày quá hạn = hôm nay − hạn chót (≥ 0). `due`/`today` dạng "YYYY-MM-DD".
pub fn overdue_days(due: &str, today: &str) -> i64 {
    match (parse_iso(due), parse_iso(today)) {
        (Some(d), Some(t)) => (t - d).num_days().max(0),
        _ => 0,
    }
}

/// "Còn N ngày" ở Thùng rác: 30 − số ngày đã qua kể từ lúc xoá (docs/03 Q5).
pub fn trash_days_left(deleted_at: i64, now: i64) -> i64 {
    TRASH_RETENTION_DAYS - (now - deleted_at) / DAY_MS
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;

    fn vn() -> FixedOffset {
        FixedOffset::east_opt(7 * 3600).unwrap()
    }

    #[test]
    fn clock_on_saturday_12_09_2026() {
        let now = vn().with_ymd_and_hms(2026, 9, 12, 10, 0, 0).unwrap();
        let c = Clock::at(now);
        assert_eq!(c.today, "2026-09-12");
        assert_eq!(c.tomorrow, "2026-09-13");
        assert_eq!(c.monday, "2026-09-07");
        assert_eq!(c.sunday, "2026-09-13");
        let monday_vn = vn().with_ymd_and_hms(2026, 9, 7, 0, 0, 0).unwrap();
        assert_eq!(c.week_start_ms, monday_vn.timestamp_millis());
        assert_eq!(c.next_week_start_ms - c.week_start_ms, 7 * DAY_MS);
    }

    #[test]
    fn monday_is_start_of_week() {
        let sunday = NaiveDate::from_ymd_opt(2026, 9, 13).unwrap();
        assert_eq!(iso(week_monday(sunday)), "2026-09-07");
        let monday = NaiveDate::from_ymd_opt(2026, 9, 14).unwrap();
        assert_eq!(iso(week_monday(monday)), "2026-09-14");
    }

    #[test]
    fn parse_iso_is_strict() {
        assert!(parse_iso("2026-09-12").is_some());
        assert!(parse_iso("2026-9-12").is_none());
        assert!(parse_iso("2026-02-30").is_none());
    }

    #[test]
    fn overdue_and_trash_days() {
        assert_eq!(overdue_days("2026-09-10", "2026-09-12"), 2);
        assert_eq!(overdue_days("2026-09-15", "2026-09-12"), 0);
        assert_eq!(trash_days_left(0, 0), 30);
        assert_eq!(trash_days_left(0, 3 * DAY_MS + 5), 27);
    }
}
