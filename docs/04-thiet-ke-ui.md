# 04 — Thiết kế UI (bản Gọn)

> **Tóm tắt**
> - Hướng giao diện **C · Sổ màu**: font Nunito, bo góc lớn, nền tím nhạt, có chế độ sáng và tối.
> - 9 màn hình SC-1…SC-9, mỗi màn một artboard bấm được. Xem offline tại [design/quan-ly-task-ui.html](../design/quan-ly-task-ui.html), mở bằng trình duyệt.
> - Nghiệp vụ của từng màn nằm ở [02-nghiep-vu.md](02-nghiep-vu.md). File này chỉ quy định cách hiển thị để dev dựng giao diện đúng.

## 1. File thiết kế

| File | Nội dung |
|---|---|
| `design/quan-ly-task-ui.html` | Canvas xem offline: trang "Màn hình" (9 artboard) và trang "Lưu trữ" (3 hướng phác thảo) |
| `design/Main.dc.html` | SC-1 Tổng quan |
| `design/Tasks.dc.html` | SC-2 Công việc |
| `design/ProjectBoard.dc.html` | SC-3 Dự án: Kanban, Danh sách, sửa/xoá dự án |
| `design/TaskForm.dc.html` | SC-4 Tạo / Sửa việc |
| `design/TaskDetail.dc.html` | SC-5 Chi tiết việc |
| `design/Employees.dc.html` | SC-6 Nhân viên |
| `design/EmployeeDetail.dc.html` | SC-7 Chi tiết nhân viên, chuyển Đã nghỉ |
| `design/Trash.dc.html` | SC-8 Thùng rác |
| `design/Settings.dc.html` | SC-9 Cài đặt |
| `design/erd.html` | Sơ đồ cơ sở dữ liệu |

Mã nguồn các artboard (template + dữ liệu mẫu + logic tương tác) dùng làm tham chiếu khi dựng component React.

## 2. Nguyên tắc hiển thị

1. **Trạng thái** = chip màu có icon. **Dự án** = ô vuông màu + tên/mã, không dùng nền màu cho dự án (tránh lẫn với trạng thái). **Người** = avatar tròn chữ tắt + tên; người đã nghỉ có nhãn "Đã nghỉ". **Ưu tiên** = icon cờ + chữ màu, không nền. **Mã việc** chữ đậm màu phụ.
2. Quá hạn: ngày hạn màu đỏ + dòng "Quá hạn N ngày", dòng trong bảng có nền đỏ nhạt. Đã huỷ: tiêu đề gạch ngang (Hoàn thành không gạch).
3. Mỗi màn/hộp thoại chỉ một nút chính (nền đậm). Nút xoá dùng kiểu nguy hiểm (nền đỏ nhạt, chữ đỏ).
4. Chữ trên nút nói đúng hành động ("Tạo việc", "Lưu" ở hộp "Sửa {mã}", "Khôi phục"). Thông báo lỗi nói lỗi gì và cách sửa.
5. Không emoji; icon là SVG nét 2px (lucide-react trong app thật).

## 3. Design token

Định nghĩa bằng biến CSS trong `src/styles/globals.css`, map sang `@theme` của Tailwind v4. Chế độ tối bật bằng class `.dark` trên `<html>`; "Theo hệ thống" đọc `prefers-color-scheme`.

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--bg` | `#F1F0F7` | `#14121D` | Nền cửa sổ |
| `--surface` | `#FFFFFF` | `#1D1A29` | Sidebar, thẻ, panel |
| `--surface2` | `#F6F5FB` | `#25213A` | Nền phụ, ô nhập, nút phụ |
| `--ink` | `#26233A` | `#ECEAF5` | Chữ chính |
| `--ink2` | `#4E4868` | `#C3BFD6` | Chữ menu, mô tả |
| `--muted` | `#6B6682` | `#9A96B0` | Chữ phụ |
| `--line` | `#ECEAF3` | `#2C2840` | Viền, đường kẻ |
| `--hero` / `--heroInk` | `#E6DEFF` / `#6A5BB0` | `#2C2550` / `#BBAEFF` | Vùng nhấn nhẹ, liên kết |
| `--btn` / `--btnInk` | `#2A2540` / `#FFFFFF` | `#E6DEFF` / `#1B1730` | Nút chính, mục menu đang chọn |
| `--pill` | `#EEEBF7` | `#2C2840` | Huy hiệu đếm, rãnh thanh tiến độ |
| `--danger` / `--dangerBg` | `#B23A26` / `#FFE7E2` | `#FF9C8A` / `#3A1D1A` | Quá hạn, xoá |
| `--overdueRow` | `#FFF1EE` | `#2E1C22` | Nền dòng quá hạn |
| `--scrim` | `rgba(38,35,58,.28)` | `rgba(0,0,0,.55)` | Lớp tối sau hộp thoại/panel |
| Focus ring | `2px solid #8C7AE6`, offset 2px | giống | Phần tử nhận focus bằng bàn phím |

### 3.1 Trạng thái (chip nền / chữ)

| Trạng thái | Sáng | Tối |
|---|---|---|
| Mới | `#EEEBF7` / `#57536D` | `#2C2840` / `#C3BFD6` |
| Đang làm | `#DDE8FF` / `#1F4E99` | `#1E2C4A` / `#A9C4FF` |
| Đang chờ | `#FFF3C9` / `#7A5A00` | `#3A3116` / `#F0D27A` |
| Hoàn thành | `#D8F2E3` / `#1F6B41` | `#173A29` / `#8FDDB0` |
| Đã huỷ | `#F1EFF4` / `#6B6682` | `#26232F` / `#9A96B0` |

### 3.2 Ưu tiên (màu chữ + icon cờ)

| Ưu tiên | Sáng | Tối |
|---|---|---|
| Thấp | `#6B6682` | `#9A96B0` |
| Trung bình | `#9A6B00` | `#F0D27A` |
| Cao | `#C4521F` | `#FFB59E` |
| Khẩn cấp | `#C62828` | `#FF9C8A` |

### 3.3 Màu dự án và avatar

- Dự án (ô vuông): `#5B8DEF`, `#4DBB7F`, `#F28B6E`, `#E5B93A`, `#8C7AE6` + 5 màu bổ sung chọn ở M1 cùng độ đậm.
- Avatar nhân viên (10 màu, chữ trắng): `#6E56CF` `#2F80ED` `#D9622B` `#2E8B57` `#C2527A` `#B7791F` `#0E9AA7` `#7A5AF8` `#E5484D` `#5F6B7A`.

## 4. Kiểu chữ, bo góc, khoảng cách

- **Nunito** 600/700/800, **đóng gói sẵn** vào app bằng `@fontsource/nunito` (app offline, không tải Google Fonts). Font dự phòng `"Segoe UI", system-ui, sans-serif`.
- Cỡ chữ: tiêu đề màn 26px/800 · tiêu đề thẻ 16px/800 · tiêu đề việc 14,5px/700 · chữ thường 14px · chữ phụ 12,5–13px · chip 12px/800.
- Bo góc: sidebar/panel/hộp thoại 24px · thẻ 22px · thẻ Kanban 16px · ô nhập 12px · nút tròn hai đầu · chip 11px.
- Khoảng cách: 14px giữa khối lớn, padding thẻ 18×20px, nút cao 40px (nhỏ 32px).

## 5. Bố cục

- Cửa sổ mặc định 1280×860, tối thiểu 1024×680. Thanh tiêu đề tự vẽ (`decorations: false` + `data-tauri-drag-region`, 3 nút cửa sổ ở góc phải).
- Sidebar cố định 224px: Tổng quan · Công việc · Nhân viên · nhóm DỰ ÁN (danh sách + "Dự án mới") · Thùng rác · Cài đặt.
- Thanh trên: ô tìm kiếm, nút sáng/tối, nút "Thêm việc". Mỗi màn tự cuộn bên trong; sidebar và thanh trên đứng yên.
- Bảng dữ liệu: dựng bằng lưới cột cố định, dòng cao ~52px, tiêu đề cột bấm để sắp xếp.

## 6. Thành phần (ánh xạ shadcn/ui)

| Thành phần | Dùng ở | shadcn/ui |
|---|---|---|
| Hộp thoại form | Tạo/Sửa việc, Nhân viên, Dự án | `Dialog` |
| Panel chi tiết | Chi tiết việc | `Sheet` (bên phải, rộng ~560px) |
| Chọn nhân viên | Người phụ trách, Người tạo, tác giả bình luận | `Combobox` (Popover + Command) có avatar + chức danh |
| Chọn ngày | Ngày bắt đầu, Hạn chót | `Popover` + `Calendar` (tuần bắt đầu thứ Hai) |
| Nút phân đoạn | Trạng thái và Ưu tiên (form việc), Kanban/Danh sách, Sáng/Tối | `ToggleGroup` |
| Tab | Chi tiết việc, Chi tiết nhân viên | `Tabs` |
| Xác nhận | Xoá, Dọn sạch, Khôi phục dữ liệu | `AlertDialog` |
| Thông báo | "Đã tạo WEB-16", "Đã chuyển WEB-16 vào Thùng rác" | `Sonner` |
| Kanban | Dự án | tự viết, kéo thả bằng dnd-kit |

## 7. Khác biệt giữa prototype và app thật

| Hạng mục | Prototype | App thật |
|---|---|---|
| Kéo thả Kanban | Nút "Chuyển…" trên thẻ | Kéo thả bằng dnd-kit. Kanban chỉ kéo thả; đổi trạng thái khác qua dropdown ở Chi tiết việc |
| Điều hướng | Mỗi màn một artboard, bấm menu chỉ hiện thông báo | Điều hướng thật giữa các màn |
| Dữ liệu | Mẫu, mất khi đóng trang | SQLite ([03](03-co-so-du-lieu.md)) |
| Mở tệp, sao lưu | Mô phỏng | Hộp thoại chọn file của Windows, mở bằng ứng dụng mặc định |

## 8. Việc còn mở

- **Icon app** (file `.ico` cho bộ cài, Start Menu, thanh tác vụ): chưa thiết kế, làm ở M0.
