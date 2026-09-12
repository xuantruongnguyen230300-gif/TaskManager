# Quản lý Task

App desktop Windows (cài bằng `.exe`), chạy offline, dành cho **manager** quản lý việc của nhân viên. Chỉ manager dùng app. Ưu tiên hàng đầu: **đơn giản, dễ dùng**.

## Cách làm việc với dự án này

- Luôn trả lời bằng tiếng Việt.
- Quy trình: chốt công nghệ → nghiệp vụ → thiết kế UI → kiến trúc & quy trình phát triển → báo cáo. **Không viết code ứng dụng hay dựng khung dự án cho đến khi chủ dự án đồng ý rõ ràng.**
- **Giữ phạm vi GỌN**: không tự thêm chức năng, trường, màn hình ngoài danh sách bên dưới. Chủ dự án không muốn phần mềm phình to.
- Không "audit" rườm rà trong quá trình làm: hạn chế các vòng rà soát, chụp ảnh, kịch bản kiểm tra dài; chỉ kiểm tra tối thiểu cần thiết.
- Prototype chỉ giữ file trên máy, **không đưa lên link online**.
- Tài liệu trong `docs/` (bắt đầu từ `docs/00-bao-cao-tong-hop.md`). Thiết kế trong `design/`: bản xem offline `design/quan-ly-task-ui.html`, ERD `design/erd.html`.

## Phạm vi GỌN (chốt 12/09/2026)

- **Màn hình:** Tổng quan · Công việc · Dự án (Kanban 5 cột cố định | Danh sách) · Nhân viên (+ chi tiết nhân viên) · Thùng rác · Cài đặt; form Tạo/Sửa việc; chi tiết việc.
- **Việc:** mã tự sinh (ví dụ WEB-12), tiêu đề, mô tả, dự án, người phụ trách (tối đa 1), người tạo (chọn từ danh mục nhân viên, mặc định là manager), trạng thái (Mới · Đang làm · Đang chờ · Hoàn thành · Đã huỷ, chuyển tự do), ưu tiên, ngày bắt đầu, hạn chót, giờ bắt đầu / kết thúc thực tế, ngày tạo, việc con, bình luận, file đính kèm, lịch sử thay đổi (tự ghi từng trường).
- **Nhân viên:** danh mục đơn giản; manager là hồ sơ "Tôi".
- **Cài đặt:** hồ sơ của tôi, sáng/tối, sao lưu/khôi phục (.zip gồm cả tệp đính kèm).
- **Đã chốt thêm (12/09, sau vòng đối chiếu):** xoá nhân viên qua menu ⋯ ở màn Nhân viên (chỉ người chưa có việc/bình luận), nút "Làm việc lại" ở chi tiết nhân viên; rời Đang chờ/Đã huỷ thì xoá lý do (vẫn còn trong lịch sử); mã dự án khoá khi dự án đã có việc; bảng Công việc mặc định sắp ngày tạo mới nhất trước; chi tiết việc có vùng Mô tả chỉ đọc; xoá vĩnh viễn việc thì xoá cả lịch sử của việc đó; chuyển sang Hoàn thành thì Kết thúc thực tế = ngày giờ hiện tại (sửa lại được), số "Hoàn thành" tính theo Kết thúc thực tế.
- **Không làm:** Hộp thư, Hôm nay, Sắp tới, Lịch, Thống kê riêng, Ctrl+K, Thêm nhanh toàn cục & cú pháp gõ tự nhiên, khay hệ thống, nhắc nhở, cột Kanban tuỳ chỉnh, phòng ban, tag, thao tác hàng loạt, English, màn chào, nhập/xuất JSON/CSV, ước lượng, Pomodoro.

## Công nghệ (đã duyệt 12/09/2026) và giao diện

- Tauri 2 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui; cơ sở dữ liệu SQLite (sqlx). Biome thay ESLint, dnd-kit bản ổn định.
- Điều kiện của mọi lựa chọn kỹ thuật: **hiệu năng tốt** (mục tiêu ở `docs/05`) và **UX/UI đúng thiết kế** (`docs/04`, `design/`).
- Mã định danh app: `vn.personal.quanlytask` (đã chốt; không đổi sau khi phát hành). Icon app làm ở M0.
- Tên app: **Quản lý Task**. Hướng giao diện **C · Sổ màu** (Nunito, bo góc lớn, sáng/tối).

## Môi trường máy dev

- Đã có: Node 24, npm 11, Git, WebView2, Chrome.
- Chưa có: Rust (rustup) và Visual Studio Build Tools (workload "Desktop development with C++"), cả hai bắt buộc để build Tauri.
