// Ẩn cửa sổ console ở bản release trên Windows. KHÔNG xoá dòng này.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    quan_ly_task_lib::run()
}
