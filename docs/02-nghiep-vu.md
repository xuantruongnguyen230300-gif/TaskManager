# 02 — Nghiệp vụ (bản gọn v3)

> **Tóm tắt**
> - **Quản lý Task** là app desktop Windows (cài `.exe`, chạy offline). **Chỉ manager dùng**, để tạo, giao và theo dõi việc của nhân viên. Nhân viên không dùng app, họ chỉ là dữ liệu trong danh mục Nhân viên.
> - Manager cũng là một bản ghi nhân viên, hiển thị là "Tôi". Lần đầu chạy, app tự tạo hồ sơ này và dự án "Việc chung" (mã `VC`).
> - Mỗi việc có **mã** không đổi (`WEB-12`), 5 trạng thái chuyển tự do, người phụ trách, người tạo, ngày bắt đầu, hạn chót, thời gian thực tế, việc con, bình luận, tệp đính kèm và lịch sử thay đổi.
> - Nguồn sự thật: đặc tả bản gọn v3 (12/09/2026). **Không thêm chức năng, trường, màn hình hay quy tắc nào ngoài tài liệu này.**
> - Quy ước: giờ theo giờ máy, tuần bắt đầu thứ Hai. Trong bảng, thẻ và danh sách, ngày hiển thị rút gọn `dd/MM` (năm hiện tại) hoặc "Hôm nay" / "Mai"; ở Chi tiết việc và Lịch sử hiển thị đủ `dd/MM/yyyy` / `dd/MM/yyyy HH:mm`.

---

## 1. Phạm vi

**Có:** 9 màn hình (SC-1…SC-9), danh mục nhân viên, dự án, việc (5 trạng thái), việc con, bình luận, tệp đính kèm, lịch sử, Thùng rác, tìm kiếm, giao diện Sáng/Tối, sao lưu/khôi phục `.zip`.

**Không làm:** Hộp thư, Hôm nay, Sắp tới, Lịch, màn Thống kê riêng, Ctrl+K, Thêm nhanh toàn cục và cú pháp gõ tự nhiên, khay hệ thống, nhắc nhở/thông báo Windows, cột Kanban tuỳ chỉnh, phòng ban, tag, thao tác hàng loạt, tiếng Anh, màn chào lần đầu, nhập/xuất JSON/CSV, ước lượng, giờ của hạn chót, mã nhân viên, Pomodoro. Không có đăng nhập hay phân quyền.

---

## 2. Màn hình

**Khung chung**
- **Sidebar:** Tổng quan · Công việc · Nhân viên · nhóm **DỰ ÁN** (danh sách dự án, bấm để mở SC-3; mục "Dự án mới" mở form dự án) · Thùng rác · Cài đặt.
- **Thanh trên:** ô tìm kiếm (gõ rồi Enter thì mở SC-2 với từ khoá đó), nút Sáng/Tối, nút **"Thêm việc"** (mở SC-4).
- **Form Dự án** (hộp thoại nhỏ): Tên*, Mã* (2–6 ký tự in hoa hoặc số, bắt đầu bằng chữ, không trùng), Màu. Mã chỉ đổi được khi dự án chưa có việc nào (kể cả trong Thùng rác); đã có việc thì ô Mã bị khoá, kèm ghi chú "Không đổi được mã vì dự án đã có việc."
- Việc đã xoá (đang ở Thùng rác) không hiện ở đâu cả, trừ SC-8, và không được tính vào số liệu nào.

### SC-1 Tổng quan
| Vùng | Nội dung | Khi bấm |
|---|---|---|
| 4 số | Đang mở · Quá hạn · Đang chờ · Hoàn thành tuần này (cách tính ở §8) | Chỉ để xem |
| Cần chú ý | Việc quá hạn và việc đến hạn hôm nay hoặc ngày mai. Mỗi dòng: mã, tiêu đề, chip trạng thái, người phụ trách, hạn chót | Mở SC-5 (không có thao tác hoàn thành nhanh) |
| Theo nhân viên | Mỗi nhân viên đang làm việc: tên, số việc đang mở, số việc quá hạn | Mở SC-7 |

### SC-2 Công việc
| Mục | Nội dung |
|---|---|
| Cột | Mã, Tiêu đề, Dự án, Người phụ trách, Trạng thái, Ưu tiên, Bắt đầu, Hạn, Người tạo, Ngày tạo. Dưới tiêu đề hiện số việc con x/y, số bình luận, số tệp (nếu có) |
| Lọc | Dự án · Người phụ trách (có mục "Chưa giao") · Trạng thái (mặc định Mới + Đang làm + Đang chờ) · Hạn (Quá hạn / Tuần này / Không có hạn) |
| Tìm | Theo mã hoặc tiêu đề, không phân biệt hoa thường và dấu (R-11) |
| Thao tác | Mặc định sắp theo **Ngày tạo, mới nhất trước**. Bấm tiêu đề cột để sắp xếp tăng/giảm (mọi cột đều sắp được). Bấm một dòng để mở SC-5 |

### SC-3 Dự án
| Mục | Nội dung |
|---|---|
| Đầu trang | Mã, tên, tiến độ "x/y (z%)" (§8; mẫu số 0 thì hiện "—"). Nút **Sửa dự án** (mở form Dự án), **Xoá dự án** (R-02) |
| Chuyển chế độ | **Kanban** / **Danh sách** |
| Kanban | 5 cột cố định, mỗi cột một trạng thái. Cột "Đã huỷ" thu gọn mặc định. Thẻ hiện mã, tiêu đề, ưu tiên, người phụ trách, hạn, kèm số việc con / bình luận / tệp; sắp theo hạn chót tăng dần, việc không có hạn ở cuối. Cuối các cột Mới, Đang làm, Đang chờ có nút **"+ Thêm việc"** (mở SC-4, điền sẵn dự án và trạng thái của cột). Kéo thẻ sang cột khác = đổi trạng thái (§5). Bấm thẻ mở SC-5 |
| Danh sách | Bảng SC-2, bộ lọc Dự án khoá sẵn là dự án này |
| Lọc | Theo người phụ trách (áp dụng cho cả hai chế độ) |

### SC-4 Form Tạo / Sửa việc
Hộp thoại, xem §3.

### SC-5 Chi tiết việc
Panel bên phải, xem §4.

### SC-6 Nhân viên
| Mục | Nội dung |
|---|---|
| Cột | Họ tên, Chức danh, Điện thoại, Email, Đang mở, Quá hạn, Trạng thái (Đang làm việc / Đã nghỉ) |
| Lọc / Tìm | Đang làm việc (mặc định) / Đã nghỉ / Tất cả. Tìm theo tên |
| Thao tác | Nút **"Thêm nhân viên"** mở form: Họ tên* (1–100 ký tự), Chức danh, Điện thoại, Email, Màu đại diện. Bấm dòng mở SC-7. Menu **⋯** ở mỗi dòng: **Sửa** · **Chuyển sang Đã nghỉ** (R-04) · **Xoá** (chỉ xoá được người chưa có việc/bình luận, R-05; nếu đã có thì hiện hộp thoại "Không thể xoá {họ tên}", §9) |

### SC-7 Chi tiết nhân viên
- Thông tin: họ tên, chức danh, điện thoại, email, màu, trạng thái.
- 3 số: Đang mở · Quá hạn · Hoàn thành 30 ngày (§8).
- Danh sách việc có 2 tab: **Đang phụ trách** (việc đang mở của người này) / **Đã hoàn thành**. Bấm dòng mở SC-5.
- Nút **Sửa** (mở form nhân viên) và **"Chuyển sang Đã nghỉ"** (R-04). Người Đã nghỉ có nút **"Làm việc lại"** (không cần xác nhận; toast "Đã chuyển {họ tên} về Đang làm việc"). Hồ sơ "Tôi" không có nút chuyển Đã nghỉ.

### SC-8 Thùng rác
| Mục | Nội dung |
|---|---|
| Cột | Mã, Tiêu đề, Dự án, Xoá lúc, "Còn N ngày" (N = 30 − số ngày đã qua kể từ lúc xoá) |
| Thao tác | **Khôi phục** (việc trở lại nguyên trạng thái, nguyên mã) · **Xoá vĩnh viễn** (một dòng, có xác nhận) · **Dọn sạch** (tất cả, có xác nhận) |

### SC-9 Cài đặt
| Mục | Nội dung |
|---|---|
| Hồ sơ của tôi | Họ tên, chức danh, điện thoại, email, màu của bản ghi "Tôi" |
| Giao diện | Sáng / Tối / Theo hệ thống (lưu trong `settings`) |
| Dữ liệu | **Sao lưu** ra file `.zip` · **Khôi phục** từ file `.zip` (R-10) · hiển thị vị trí thư mục dữ liệu |

---

## 3. Form Tạo / Sửa việc (SC-4)

Tiêu đề hộp thoại: "Tạo việc mới" / "Sửa {mã}". Thứ tự trường đúng như bảng.

| # | Nhãn | Control | Bắt buộc | Mặc định | Kiểm tra | Thông điệp lỗi |
|---|---|---|---|---|---|---|
| 1 | Dự án | Dropdown dự án | ✓ | Dự án đang xem; không có thì "Việc chung" | Có giá trị | "Vui lòng chọn dự án." |
| 2 | Tiêu đề | Ô chữ | ✓ | trống | Bỏ khoảng trắng đầu/cuối; 1–500 ký tự | "Vui lòng nhập tiêu đề." · "Tiêu đề tối đa 500 ký tự." |
| 3 | Mô tả | Ô chữ nhiều dòng | | trống | — | — |
| 4 | Người phụ trách | Dropdown: "Chưa giao" + nhân viên đang làm việc | | Chưa giao | Tối đa 1 người, phải đang làm việc (R-03) | — |
| 5 | Người tạo | Dropdown danh mục nhân viên | ✓ | Tôi | Có giá trị | "Vui lòng chọn người tạo." |
| 6 | Trạng thái | Nút phân đoạn 5 trạng thái | | Mới (mở từ "+ Thêm việc" trên Kanban: trạng thái của cột) | Chọn Đang chờ / Đã huỷ thì hiện ô **Lý do chờ / Lý do huỷ** (không bắt buộc) ngay trong form, không mở hộp riêng | — |
| 7 | Ưu tiên | Nút phân đoạn: Thấp · Trung bình · Cao · Khẩn cấp | | Trung bình | — | — |
| 8 | Ngày bắt đầu | Chọn ngày, có nút xoá | | trống | Nếu có hạn chót: ≤ hạn chót (R-06) | "Ngày bắt đầu phải trước hoặc bằng hạn chót." |
| 9 | Hạn chót | Chọn ngày (không có giờ), có nút xoá | | trống | — | — |
| 10 | Việc con | Danh sách dòng chữ, nút thêm dòng / xoá dòng | | trống | Dòng trống bị bỏ khi lưu | — |
| 11 | Tệp đính kèm | Nút "Chọn tệp"; mỗi tệp: tên, dung lượng, nút gỡ | | trống | Mỗi tệp ≤ 50 MB (R-09) | "Tệp “{tên}” vượt quá 50 MB." |

- **Dòng thông tin:** khi tạo hiện "Mã việc và ngày tạo được ghi tự động khi lưu"; khi sửa hiện mã và ngày tạo (chỉ đọc).
- **Nút:** Huỷ · **Tạo việc** (khi tạo) / **Lưu** (khi sửa).
- Lỗi hiện ngay dưới trường tương ứng. Còn lỗi thì không lưu.
- Khi sửa, nếu người phụ trách hoặc người tạo hiện tại đã nghỉ thì vẫn giữ và hiện kèm "(đã nghỉ)"; chỉ chọn mới được người đang làm việc.
- Lưu khi tạo: sinh mã (R-01), ghi `created_at`, áp tác động trạng thái (§5), chép tệp vào thư mục dữ liệu, ghi lịch sử "Tạo việc".

---

## 4. Chi tiết việc (SC-5)

Panel bên phải, mở từ bất kỳ dòng hoặc thẻ việc nào.

| Vùng | Nội dung |
|---|---|
| Đầu | Mã · dropdown trạng thái (đổi ngay, áp §5) · tiêu đề · nút **Sửa** (mở SC-4) · nút **Xoá** (xác nhận → Thùng rác) · nút đóng |
| Mô tả | Ngay dưới tiêu đề, chỉ đọc; sửa qua nút **Sửa** |
| Thông tin | Dự án, Người phụ trách, Người tạo, Ưu tiên, Ngày bắt đầu, Hạn chót (chữ đỏ + "Quá hạn N ngày" nếu quá hạn), Bắt đầu thực tế, Kết thúc thực tế, Ngày tạo, Cập nhật lần cuối |
| Ghi chú | Nếu có lý do chờ/huỷ (`status_note`): một dòng "Lý do chờ: …" / "Lý do huỷ: …" |

**Sửa tại chỗ:** chỉ **Bắt đầu thực tế** và **Kết thúc thực tế** (chọn ngày giờ, xoá được), kiểm tra R-06; lỗi: "Kết thúc thực tế phải sau hoặc bằng bắt đầu thực tế." Mọi trường khác sửa qua nút Sửa.

| Tab | Nội dung và thao tác |
|---|---|
| Việc con | Danh sách có ô tick; thêm dòng; xoá dòng |
| Bình luận | Danh sách (tác giả, thời điểm, nội dung), mới nhất ở cuối. Ô thêm bình luận kèm dropdown tác giả (chỉ nhân viên đang làm việc, mặc định Tôi). Xoá được từng bình luận |
| Tệp | Danh sách (tên, dung lượng, ngày thêm), nút **Mở** (mở bằng ứng dụng mặc định của Windows) và **Gỡ** |
| Lịch sử | Danh sách mới nhất trước, định dạng ở §7 |

---

## 5. Trạng thái

| Trạng thái | Giá trị lưu | Màu |
|---|---|---|
| Mới | `new` | Xám |
| Đang làm | `in_progress` | Xanh dương |
| Đang chờ | `waiting` | Vàng |
| Hoàn thành | `done` | Xanh lá |
| Đã huỷ | `cancelled` | Xám nhạt, chữ gạch ngang |

- **Chuyển tự do** giữa bất kỳ hai trạng thái nào. Không có bảng cấm.
- Đổi trạng thái được từ: dropdown ở SC-5, kéo thẻ trên Kanban, trường Trạng thái trong SC-4.

**Tác động khi chuyển**

| Chuyển vào / ra | Tác động |
|---|---|
| Vào **Đang chờ** | Hỏi lý do chờ (không bắt buộc) → lưu `status_note` |
| Vào **Đã huỷ** | Hỏi lý do huỷ (không bắt buộc) → lưu `status_note` |
| Vào **Đang làm** | Nếu Bắt đầu thực tế trống → điền thời điểm hiện tại |
| Vào **Hoàn thành** | Kết thúc thực tế = ngày giờ hiện tại (lúc chuyển trạng thái); sửa lại được ở Chi tiết việc |
| Rời **Hoàn thành** | Xoá Kết thúc thực tế |
| Rời **Đang chờ** / **Đã huỷ** | Xoá `status_note` (lý do cũ vẫn xem được trong Lịch sử, xem §7) |

Hộp hỏi lý do (khi đổi ở SC-5 hoặc kéo thẻ Kanban; trong SC-4 lý do nhập ngay ở ô trong form) có nút Huỷ và Xác nhận. Bấm Huỷ hoặc Esc thì trạng thái không đổi (trên Kanban, thẻ trở về cột cũ).

---

## 6. Quy tắc

| Mã | Quy tắc |
|---|---|
| R-01 | Mã việc = `<mã dự án>-<số>`. Số tự tăng theo từng dự án (`projects.next_task_no`), bắt đầu từ 1. Mã không bao giờ đổi, kể cả khi việc chuyển sang dự án khác. |
| R-02 | Dự án chỉ xoá được khi không còn việc nào, kể cả việc trong Thùng rác. Dự án "Việc chung" không xoá được. |
| R-03 | Mỗi việc có tối đa 1 người phụ trách, chỉ được chọn nhân viên đang làm việc. Có thể để "Chưa giao". |
| R-04 | Chuyển nhân viên sang Đã nghỉ khi người đó còn việc chưa xong (Mới / Đang làm / Đang chờ) → hộp thoại bắt chọn: giao tất cả cho một nhân viên đang làm việc khác, hoặc để "Chưa giao". |
| R-05 | Nhân viên đã có việc (phụ trách hoặc là người tạo) hoặc có bình luận thì không xoá được, chỉ chuyển Đã nghỉ. Hồ sơ "Tôi" không xoá được và không chuyển Đã nghỉ được. |
| R-06 | Ngày bắt đầu ≤ hạn chót (khi có cả hai). Kết thúc thực tế ≥ bắt đầu thực tế (khi có cả hai). |
| R-07 | Xoá việc = chuyển vào Thùng rác (`deleted_at`). Sau 30 ngày app tự xoá vĩnh viễn (kiểm tra mỗi lần mở app). Xoá vĩnh viễn thì xoá luôn việc con, bình luận, tệp (cả file vật lý) và lịch sử của việc. |
| R-08 | Lịch sử tự ghi các thay đổi liệt kê ở §7. Việc con và bình luận không ghi lịch sử. Không có cột người sửa, vì người thao tác luôn là manager. |
| R-09 | Tệp đính kèm được chép vào thư mục dữ liệu của app; mỗi tệp tối đa 50 MB; mở bằng ứng dụng mặc định của Windows. |
| R-10 | Sao lưu tạo một file `.zip` gồm dữ liệu và tệp đính kèm. Khôi phục thay toàn bộ dữ liệu hiện tại; trước đó app tự sao lưu bản hiện tại, sau đó khởi động lại. |
| R-11 | Tìm kiếm theo mã hoặc tiêu đề, không phân biệt hoa thường và dấu (ví dụ "dang nhap" tìm được "Đăng nhập", `đ` coi như `d`). |

**Kiểm tra form Dự án, Nhân viên và giới hạn độ dài khác**

| Trường | Kiểm tra | Thông điệp lỗi |
|---|---|---|
| Tên dự án | Bắt buộc; ≤ 100 ký tự | "Vui lòng nhập tên dự án." · "Tên dự án tối đa 100 ký tự." |
| Mã dự án | Bắt buộc; 2–6 ký tự A–Z, 0–9, bắt đầu bằng chữ; không trùng dự án khác | "Vui lòng nhập mã dự án." · "Mã dự án gồm 2–6 ký tự, bắt đầu bằng chữ cái, chỉ gồm A–Z và 0–9." · "Mã “{mã}” đã được dùng cho dự án khác." |
| Họ tên nhân viên | Bắt buộc; 1–100 ký tự sau khi bỏ khoảng trắng đầu/cuối | "Vui lòng nhập họ tên." · "Họ tên tối đa 100 ký tự." |
| Chức danh / Điện thoại / Email | ≤ 100 / ≤ 20 / ≤ 254 ký tự | "Chức danh tối đa 100 ký tự." · "Điện thoại tối đa 20 ký tự." · "Email tối đa 254 ký tự." |
| Việc con | Mỗi dòng ≤ 500 ký tự | "Việc con tối đa 500 ký tự." |
| Bình luận | 1–5.000 ký tự | "Bình luận tối đa 5.000 ký tự." |

---

## 7. Lịch sử

**Được ghi** (mỗi thay đổi là một dòng `task_history`, giá trị lưu sẵn dạng chữ hiển thị):

| Sự kiện | Dòng hiển thị |
|---|---|
| Tạo việc | `12/09/2026 08:20 · Tạo việc` |
| Đổi Tiêu đề, Dự án, Trạng thái, Ưu tiên, Người phụ trách, Người tạo, Ngày bắt đầu, Hạn chót, Bắt đầu thực tế, Kết thúc thực tế | `12/09/2026 08:20 · Ưu tiên: Trung bình → Cao` |
| Đổi Mô tả | `12/09/2026 08:20 · Mô tả: đã sửa` |
| Thêm / gỡ tệp | `12/09/2026 08:20 · Thêm tệp: bao-gia.pdf` · `Gỡ tệp: bao-gia.pdf` |
| Xoá / khôi phục | `12/09/2026 08:20 · Chuyển vào Thùng rác` · `Khôi phục từ Thùng rác` |

- Định dạng thời điểm `dd/MM/yyyy HH:mm`. Giá trị trống hiển thị "(trống)". Ngày hiển thị `dd/MM/yyyy`, ngày giờ `dd/MM/yyyy HH:mm`.
- Thay đổi do hệ thống tự điền (ví dụ tự điền Kết thúc thực tế khi vào Hoàn thành) cũng ghi một dòng như trên.
- Danh sách sắp mới nhất trước.

**Không ghi:** việc con (thêm, tick, xoá), bình luận (thêm, xoá), người thao tác. Lý do chờ/huỷ không có dòng riêng mà được ghi kèm trong dòng đổi trạng thái, ví dụ "Trạng thái: Đang làm → Đang chờ (lý do: Chờ khách phản hồi)". Xoá vĩnh viễn thì lịch sử của việc cũng bị xoá (R-07).

---

## 8. Cách tính

Mọi số liệu **chỉ tính việc chưa xoá** (`deleted_at` trống). "Hôm nay" và "bây giờ" theo giờ máy.

| Chỉ số | Cách tính |
|---|---|
| Đang mở | Trạng thái Mới, Đang làm hoặc Đang chờ |
| Quá hạn | Đang mở và hạn chót < hôm nay |
| Quá hạn N ngày | N = hôm nay − hạn chót (số ngày) |
| Đang chờ (SC-1) | Trạng thái Đang chờ |
| Hoàn thành tuần này (SC-1) | Trạng thái Hoàn thành và Kết thúc thực tế từ 00:00 thứ Hai tuần này đến trước 00:00 thứ Hai tuần sau |
| Cần chú ý (SC-1) | Đang mở và hạn chót ≤ ngày mai (gồm quá hạn, đến hạn hôm nay, đến hạn ngày mai); sắp theo hạn chót tăng dần |
| Theo nhân viên (SC-1), Đang mở / Quá hạn (SC-6, SC-7) | Như Đang mở / Quá hạn, chỉ lấy việc có người phụ trách là nhân viên đó |
| Hoàn thành 30 ngày (SC-7) | Người phụ trách là nhân viên đó, trạng thái Hoàn thành, Kết thúc thực tế trong 30 ngày gần nhất (≥ bây giờ − 30 ngày) |
| Tiến độ dự án (SC-3) | x = số việc Hoàn thành; y = tổng số việc − số việc Đã huỷ; z = x / y × 100, làm tròn số nguyên. Nếu y = 0 thì hiện "—" |
| Lọc Hạn "Tuần này" (SC-2) | Hạn chót từ thứ Hai đến Chủ nhật của tuần hiện tại |
| Lọc Hạn "Không có hạn" (SC-2) | Hạn chót trống |

---

## 9. Thông điệp chính

**Thông báo (toast)**, hiện ở cạnh dưới cửa sổ, tự ẩn sau vài giây.

| Khi nào | Nội dung |
|---|---|
| Tạo việc | "Đã tạo {mã}" |
| Lưu sửa việc | "Đã lưu {mã}" |
| Xoá việc | "Đã chuyển {mã} vào Thùng rác" |
| Khôi phục việc | "Đã khôi phục {mã}" |
| Xoá vĩnh viễn / Dọn sạch | "Đã xoá vĩnh viễn {mã}" · "Đã dọn sạch Thùng rác" |
| Tạo / xoá dự án | "Đã tạo dự án {tên} ({mã})" · "Đã xoá dự án {tên}" |
| Xoá dự án bị chặn | "Chỉ xoá được dự án không còn việc nào (kể cả trong Thùng rác)." · "Không thể xoá dự án Việc chung." |
| Thêm nhân viên | "Đã thêm nhân viên {họ tên}" |
| Chuyển Đã nghỉ | "Đã chuyển {họ tên} sang Đã nghỉ. Đã giao lại {k} việc." |
| Làm việc lại | "Đã chuyển {họ tên} về Đang làm việc" |
| Tệp quá lớn | "Tệp “{tên}” vượt quá 50 MB." |
| Mở tệp không thấy | "Không tìm thấy tệp “{tên}” trong thư mục dữ liệu." |
| Sao lưu xong | "Đã sao lưu vào {đường dẫn}" |
| Khôi phục lỗi | "Tệp không phải bản sao lưu của Quản lý Task." |

**Hộp thoại xác nhận** (nút xác nhận của thao tác xoá màu đỏ; Esc = nút huỷ)

| Tiêu đề | Nội dung | Nút |
|---|---|---|
| Xoá {mã}? | "Việc sẽ được chuyển vào Thùng rác và tự xoá vĩnh viễn sau 30 ngày." | Huỷ · **Xoá** |
| Xoá vĩnh viễn {mã}? | "Việc, việc con, bình luận, tệp đính kèm và lịch sử sẽ bị xoá và không thể khôi phục." | Huỷ · **Xoá vĩnh viễn** |
| Dọn sạch Thùng rác? | "{N} việc sẽ bị xoá vĩnh viễn và không thể khôi phục." | Huỷ · **Dọn sạch** |
| Xoá dự án “{tên}”? | "Dự án sẽ bị xoá hẳn." | Huỷ · **Xoá dự án** |
| Lý do chờ / Lý do huỷ | Ô chữ nhiều dòng, không bắt buộc | Huỷ · **Xác nhận** |
| Chuyển {họ tên} sang Đã nghỉ? | "{họ tên} còn {N} việc chưa xong. Giao tất cả cho: [dropdown nhân viên đang làm việc, có “Chưa giao”]" | Huỷ · **Chuyển** |
| Không thể xoá {họ tên} | "{họ tên} đã có việc hoặc bình luận nên không xoá được, chỉ có thể chuyển sang Đã nghỉ." | Đóng · **Chuyển sang Đã nghỉ** |
| Gỡ tệp “{tên}”? | "Tệp sẽ bị gỡ khỏi việc này." | Huỷ · **Gỡ tệp** |
| Xoá bình luận? | "Bình luận sẽ bị xoá hẳn." | Huỷ · **Xoá** |
| Khôi phục dữ liệu từ bản sao lưu? | "Dữ liệu hiện tại sẽ bị thay thế. App tự sao lưu dữ liệu hiện tại trước khi khôi phục và sẽ khởi động lại." | Huỷ · **Khôi phục** |

---

## 10. Câu hỏi còn mở

Không còn câu hỏi mở. Mọi quyết định đã chốt ngày 12/09/2026, xem [00 §3](00-bao-cao-tong-hop.md).

