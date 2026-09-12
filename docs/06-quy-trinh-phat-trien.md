# 06 — Quy trình phát triển và lộ trình

> **Tóm tắt**
> - Git đơn giản: `main` luôn build được, mỗi việc một nhánh ngắn, Conventional Commits.
> - Test tối thiểu: `cargo test` cho services (mỗi quy tắc R-01…R-11 ít nhất 1 test) + vài test UI chính bằng Vitest.
> - CI GitHub Actions trên `windows-latest`: lint → test → build `.exe`.
> - Lộ trình 5 mốc M0→M4 → v1.0, **ước lượng 9–11,5 tuần** (khoảng 2–3 tháng) cho 1 dev toàn thời gian, đã tính thời gian học Rust cơ bản.

---

## 1. Git

| Hạng mục | Quy ước |
|---|---|
| Nhánh | `main` luôn build được. Làm việc trên nhánh ngắn `feat/…`, `fix/…`, `chore/…`, gộp vào `main` bằng squash merge |
| Commit | Conventional Commits: `type(scope): mô tả`. Type: `feat` `fix` `refactor` `test` `docs` `chore` `ci`. Ví dụ: `feat(tasks): ghi lịch sử khi đổi người phụ trách (R-08)` |
| File sinh | `bindings.ts`, `routeTree.gen.ts`, `.sqlx/`: commit cùng thay đổi gây ra chúng |
| Tag | `vX.Y.Z` trên `main` khi phát hành |

Trước khi gộp, tự kiểm tra: đọc lại diff, không còn code debug; nghiệp vụ nằm ở `services`; đổi SQL thì có migration mới (không sửa migration cũ) và đã chạy `cargo sqlx prepare`; CI xanh.

## 2. Chuẩn code

- **TypeScript:** `strict`, không `any`. Biome bộ `recommended`, format 2 space, 100 cột. Dữ liệu IPC luôn dùng kiểu từ `bindings.ts`.
- **Rust:** `cargo fmt`, `cargo clippy --all-targets -- -D warnings`. Không `unwrap()`/`expect()` ngoài test. Lỗi luôn là `AppError` có mã ([05 §7](05-kien-truc.md#7-xử-lý-lỗi)).
- **Chỗ đặt logic:** component chỉ hiển thị và gọi hook; command Rust ≤ ~10 dòng; quy tắc nghiệp vụ và ghi lịch sử chỉ ở `services`.
- **Đặt tên:** component/type PascalCase, hook `useXxx`, file TS kebab-case (component `PascalCase.tsx`), Rust và SQL snake_case, command IPC dạng động từ + danh từ (`set_task_status`). Tên test ghi mã quy tắc: `r07_purge_removes_comments_and_files`.
- **Kích thước (mềm):** hàm ≤ 50 dòng, component ≤ 150 dòng, file ≤ 300–400 dòng.
- Chuỗi hiển thị viết tiếng Việt trực tiếp. Ngày hiển thị `dd/MM/yyyy`.

## 3. Test tối thiểu

| Tầng | Công cụ | Phạm vi |
|---|---|---|
| Services Rust | `cargo test`, SQLite in-memory đã chạy migration | Mỗi quy tắc R-01…R-11 ([02](02-nghiep-vu.md)) ít nhất 1 test. Bắt buộc: sinh mã việc, tự điền/xoá ngày thực tế khi đổi trạng thái, lịch sử ghi đúng trường và đúng chữ, chặn xoá dự án còn việc, chuyển nhân viên Đã nghỉ + giao lại, xoá vĩnh viễn xoá cả dữ liệu con, sao lưu → khôi phục ra dữ liệu giống hệt |
| Domain Rust | `cargo test` | `fold_vi` (tìm "hoa don" ra "Hoá đơn"), "hôm nay"/"tuần này", kiểm tra ngày |
| UI | Vitest + Testing Library + `mockIPC` | Form tạo việc (lỗi thiếu tiêu đề, ngày bắt đầu sau hạn), đổi trạng thái sang Đang chờ hỏi lý do, thả thẻ Kanban gọi `set_task_status` |

Không làm E2E tự động ở v1. Trước mỗi bản phát hành chạy checklist tay ở §5.

## 4. CI — GitHub Actions (`windows-latest`)

`.github/workflows/ci.yml`, chạy trên mỗi push/PR vào `main`:

```yaml
jobs:
  build:
    runs-on: windows-latest
    env: { SQLX_OFFLINE: "true" }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - uses: dtolnay/rust-toolchain@stable
        with: { components: "rustfmt, clippy" }
      - uses: Swatinem/rust-cache@v2
        with: { workspaces: src-tauri }
      - run: pnpm install --frozen-lockfile
      - run: pnpm biome ci .
      - run: pnpm tsc --noEmit
      - run: pnpm vitest run
      - run: cargo fmt --manifest-path src-tauri/Cargo.toml --check
      - run: cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
      - run: cargo test --manifest-path src-tauri/Cargo.toml
      - run: pnpm tauri build
      - uses: actions/upload-artifact@v4
        with: { name: quanlytask-setup, path: src-tauri/target/release/bundle/nsis/*.exe }
```

Phiên bản các action là minh hoạ, xác nhận bản mới nhất ở M0. Phát hành: tag `vX.Y.Z` → tải `.exe` từ artifact của CI.

## 5. Phát hành

- Phiên bản `0.x` trong lúc phát triển (mỗi mốc một minor), **1.0.0** khi xong M4. Một nguồn phiên bản: `package.json` (`tauri.conf.json` trỏ `"version": "../package.json"`).
- Checklist tay trước phát hành:
  - [ ] Cài mới trên máy Windows 11 sạch: mở app, có "Tôi" và "Việc chung", tạo việc, kéo thẻ Kanban, đính kèm và mở tệp.
  - [ ] Cài đè lên bản trước có dữ liệu: dữ liệu còn nguyên, có file `backups\pre-migrate-*.db`.
  - [ ] Sao lưu → khôi phục trên máy khác: đủ việc, lịch sử, tệp đính kèm.
  - [ ] Giao diện sáng/tối đúng ở cả 9 màn. Quét bộ cài bằng VirusTotal.

## 6. Definition of Done

Một hạng mục **xong** khi:
- [ ] Đúng đặc tả màn hình và quy tắc liên quan ([02](02-nghiep-vu.md)), không thêm gì ngoài phạm vi.
- [ ] Có test cho quy tắc liên quan, CI xanh (lint, type-check, test, build `.exe`).
- [ ] Có trạng thái rỗng, đang tải, lỗi. Dùng được ở cả sáng lẫn tối.
- [ ] Đã chạy thử tay luồng chính bằng `pnpm tauri dev`.

## 7. Lộ trình

Ước lượng cho **1 dev toàn thời gian**, vững React/TypeScript, mới làm quen Rust/Tauri (đã gồm thời gian học cơ bản). Dev đã biết Rust thì trừ khoảng 1–1,5 tuần. Giao diện theo bản thiết kế `design/quan-ly-task-ui.html` ([04](04-thiet-ke-ui.md)).

| Mốc | Phạm vi chính | Ước lượng | Luỹ kế |
|---|---|---|---|
| M0 | Môi trường + khung dự án + CI | 1–1,5 tuần | 1–1,5 |
| M1 | Dữ liệu (8 bảng) + Nhân viên + Dự án | 1,5–2 tuần | 2,5–3,5 |
| M2 | Việc: form, chi tiết, trạng thái, lịch sử, việc con, bình luận, tệp | 3–3,5 tuần | 5,5–7 |
| M3 | Công việc + Kanban + Tổng quan | 2–2,5 tuần | 7,5–9,5 |
| M4 | Thùng rác + Cài đặt + sao lưu/khôi phục + bộ cài → **v1.0** | 1,5–2 tuần | **9–11,5** |

### M0 — Môi trường + khung (1–1,5 tuần)
- Cài môi trường ([01 §5](01-cong-nghe.md#5-chuẩn-bị-môi-trường)). Dựng Tauri 2 + Vite 8 + React 19 + TS 7 + Tailwind 4 + `shadcn init --base radix`, cấu trúc thư mục theo [05 §2–3](05-kien-truc.md#2-cây-thư-mục-frontend). Biome, CI build `.exe`. `db.rs` + PRAGMA, tauri-specta sinh `bindings.ts` cho 1 command mẫu, `AppError`, log. Layout sidebar + thanh trên, sáng/tối.
- Thử nhanh (nửa ngày): `@dnd-kit/core` với React 19.
- **Nghiệm thu:** `pnpm tauri dev` chạy, CI xanh, cài `.exe` từ artifact trên máy sạch chạy được.

### M1 — Dữ liệu + Nhân viên + Dự án (1,5–2 tuần)
- Migration 8 bảng ([03](03-co-so-du-lieu.md)), tạo "Tôi" và "Việc chung" khi chạy lần đầu, sao lưu trước migrate. Repo/service/command cho nhân viên và dự án. Màn Nhân viên (SC-6), Chi tiết nhân viên (SC-7, phần danh sách việc hoàn thiện ở M2), chuyển Đã nghỉ có giao lại (R-04, R-05). Form Dự án, danh sách dự án ở sidebar, xoá dự án (R-02).
- **Nghiệm thu:** CRUD nhân viên/dự án chạy, mã dự án đúng định dạng và không trùng, test R-02, R-04, R-05 xanh.

### M2 — Việc (3–3,5 tuần)
- Form Tạo/Sửa việc (SC-4) với việc con và tệp đính kèm. Panel Chi tiết việc (SC-5): dropdown trạng thái + hỏi lý do, sửa ngày thực tế tại chỗ, 4 tab Việc con · Bình luận · Tệp · Lịch sử. Sinh mã việc, quy tắc trạng thái, ghi lịch sử trong transaction, chép/mở/gỡ tệp, xoá vào Thùng rác.
- **Nghiệm thu:** test R-01, R-03, R-06, R-08, R-09 và quy tắc trạng thái xanh. Lịch sử hiện đúng dạng "12/09 08:20 · Ưu tiên: Trung bình → Cao". Tệp 50 MB+ bị từ chối.
- **Rủi ro:** mốc lớn nhất. Diff lịch sử nhiều trường → viết test trước.

### M3 — Công việc + Kanban + Tổng quan (2–2,5 tuần)
- Màn Công việc (SC-2): bảng, bộ lọc, tìm không dấu, sắp xếp theo cột, ô tìm ở thanh trên. Màn Dự án (SC-3): đầu trang tiến độ, Kanban 5 cột (kéo thẻ = đổi trạng thái, cột Đã huỷ thu gọn), chế độ Danh sách. Tổng quan (SC-1): 4 số, Cần chú ý, Theo nhân viên.
- **Nghiệm thu:** test R-11 và các số liệu Tổng quan (quá hạn, tuần này) với dữ liệu dựng sẵn xanh. Đạt mục tiêu hiệu năng ở [05 §8](05-kien-truc.md#8-hiệu-năng) với 5.000 việc.

### M4 — Hoàn thiện → v1.0 (1,5–2 tuần)
- Thùng rác (SC-8): khôi phục, xoá vĩnh viễn, dọn sạch, tự xoá sau 30 ngày (R-07). Cài đặt (SC-9): hồ sơ của tôi, giao diện, thư mục dữ liệu, sao lưu/khôi phục `.zip` (R-10). Icon app, thông tin bộ cài. Sửa lỗi, checklist phát hành §5.
- **Nghiệm thu:** Definition of Done cho mọi màn, test R-07, R-10 xanh, checklist phát hành đạt, tag `v1.0.0`.
- **Rủi ro:** khôi phục là thao tác nguy hiểm → test kỹ, luôn tự sao lưu trước.
