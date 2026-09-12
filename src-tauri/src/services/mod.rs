//! Nghiệp vụ: sở hữu transaction (`db::begin_write`), kiểm tra quy tắc R-01…R-11, ghi lịch sử.
//! Service ghép nhiều hàm repo trong một transaction. Không `unwrap()` ngoài test.

pub mod attachment_service;
pub mod dashboard_service;
pub mod data_service;
#[cfg(debug_assertions)]
pub mod dev_seed;
pub mod employee_service;
pub mod history;
pub mod project_service;
pub mod settings_service;
pub mod task_service;
pub mod trash_service;
