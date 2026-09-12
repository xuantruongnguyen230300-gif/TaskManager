# Báo cáo tổng hợp — Quản lý Task (bản Gọn)

> Ngày 12/09/2026 · Trạng thái: **thiết kế đã chốt đủ, sẵn sàng code**. Chưa có dòng code ứng dụng nào. Bước tiếp theo: mốc M0.

## 1. Phạm vi đã chốt

App desktop Windows (`.exe`), offline, **chỉ manager dùng** để giao việc và theo dõi việc của nhân viên. Ưu tiên đơn giản, dễ dùng.

| Có | Chi tiết |
|---|---|
| 9 màn hình | Tổng quan · Công việc · Dự án (Kanban 5 cột / Danh sách) · Tạo/Sửa việc · Chi tiết việc · Nhân viên · Chi tiết nhân viên · Thùng rác · Cài đặt |
| Việc | Mã tự sinh (WEB-12), tiêu đề, mô tả, dự án, người phụ trách (tối đa 1), người tạo (chọn từ danh mục nhân viên), 5 trạng thái chuyển tự do, ưu tiên, ngày bắt đầu, hạn chót, giờ bắt đầu / kết thúc thực tế, ngày tạo, việc con, bình luận, tệp đính kèm, lịch sử thay đổi tự ghi |
| Dữ liệu | 8 bảng SQLite ([03](03-co-so-du-lieu.md), sơ đồ [design/erd.html](../design/erd.html)) |
| Quy tắc | 11 quy tắc R-01…R-11 ([02](02-nghiep-vu.md)) |

**Không làm:** Hộp thư, Hôm nay, Sắp tới, Lịch, Thống kê riêng, Ctrl+K, Thêm nhanh toàn cục, khay hệ thống, nhắc nhở, cột Kanban tuỳ chỉnh, phòng ban, tag, thao tác hàng loạt, English, màn chào, nhập/xuất JSON/CSV, ước lượng, Pomodoro.

## 2. Sản phẩm thiết kế

| Hạng mục | Xem ở |
|---|---|
| Công nghệ: Tauri 2 + React 19 + TypeScript + Tailwind 4 + shadcn/ui, dữ liệu SQLite | [01](01-cong-nghe.md) |
| Nghiệp vụ: màn hình, form, trạng thái, quy tắc, lịch sử, cách tính số liệu | [02](02-nghiep-vu.md) |
| Cơ sở dữ liệu: ERD, DDL, truy vấn chính | [03](03-co-so-du-lieu.md), [design/erd.html](../design/erd.html) |
| Giao diện: token màu, kiểu chữ, thành phần; prototype 9 màn bấm được | [04](04-thiet-ke-ui.md), [design/quan-ly-task-ui.html](../design/quan-ly-task-ui.html) |
| Kiến trúc, danh sách command, lưu tệp, sao lưu | [05](05-kien-truc.md) |
| Quy trình, test, CI, lộ trình | [06](06-quy-trinh-phat-trien.md) |

**Thời gian ước tính:** **9–11,5 tuần** (khoảng 2–3 tháng) cho 1 developer toàn thời gian, gồm 5 mốc: M0 môi trường và khung dự án → M1 Nhân viên và Dự án → M2 Việc → M3 Công việc, Kanban và Tổng quan → M4 Thùng rác, Cài đặt, sao lưu và bộ cài.

## 3. Quyết định đã chốt (12/09/2026)

| # | Nội dung | Quyết định |
|---|---|---|
| 1 | Ghi thời gian làm | 2 mốc **Bắt đầu thực tế / Kết thúc thực tế** trên mỗi việc. Chuyển sang Đang làm thì Bắt đầu thực tế = lúc đó (nếu đang trống); chuyển sang **Hoàn thành thì Kết thúc thực tế = ngày giờ hiện tại**. Cả hai sửa lại được ở Chi tiết việc |
| 2 | Số "Hoàn thành tuần này / 30 ngày" | Tính theo Kết thúc thực tế |
| 3 | Mã định danh app | `vn.personal.quanlytask`. Người dùng không nhìn thấy; chỉ quyết định thư mục dữ liệu và việc Windows nhận ra bản cập nhật. Không đổi sau khi đã phát hành |
| 4 | Công cụ kỹ thuật | Biome thay ESLint, dnd-kit bản ổn định; điều kiện: đạt mục tiêu hiệu năng ([05](05-kien-truc.md)) và đúng thiết kế UI ([04](04-thiet-ke-ui.md)) |
| 5 | Icon app | Thiết kế ở M0 |
| 6 | Nhân viên | Xoá qua menu ⋯ ở màn Nhân viên (chỉ người chưa có việc/bình luận); "Làm việc lại" ở Chi tiết nhân viên |
| 7 | Lý do chờ / huỷ | Rời Đang chờ / Đã huỷ thì xoá lý do; lý do cũ vẫn xem được trong Lịch sử |
| 8 | Mã dự án | Khoá khi dự án đã có việc |
| 9 | Bảng Công việc | Mặc định ngày tạo mới nhất trước |
| 10 | Xoá vĩnh viễn một việc | Xoá cả lịch sử của việc đó |

Không còn câu hỏi mở.

## 4. Bước tiếp theo

1. **M0 (1–1,5 tuần):**
   - Cài Rust và Visual Studio Build Tools.
   - Dựng khung Tauri + React theo [05](05-kien-truc.md).
   - Dựng CI build ra file `.exe`.
   - Kết quả: một bộ cài chạy được, có giao diện khung (sidebar, sáng/tối).
2. Làm lần lượt M1 → M4. Cuối mỗi mốc có một bộ cài để bạn dùng thử.
