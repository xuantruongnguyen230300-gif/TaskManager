//! Command IPC (docs/05 §4). Mỗi hàm ≤ ~10 dòng: nhận input → gọi service → trả kết quả.
//! Tên tham số Rust = khoá JSON phía JS: `id`, `input`, `filter` (xem src/shared/api/commands.ts).
//! Command mới: thêm hàm ở đây, đăng ký trong `lib.rs` (generate_handler!), thêm DTO ở `dto.rs`,
//! kiểu ở `types.ts` và hàm gọi ở `commands.ts`.

pub mod attachments;
pub mod comments;
pub mod dashboard;
pub mod data;
pub mod dev;
pub mod employees;
pub mod projects;
pub mod settings;
pub mod subtasks;
pub mod tasks;
pub mod trash;
