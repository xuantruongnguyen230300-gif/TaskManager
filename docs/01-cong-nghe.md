# 01 — Quyết định công nghệ

> **Tóm tắt**
> - Stack: **Tauri 2.11 (Rust + WebView2)** cho vỏ desktop, **React 19.3 + TypeScript 7 + Vite 8** cho giao diện, **SQLite** (qua `sqlx` 0.9) cho dữ liệu. Bộ cài NSIS `.exe` khoảng 5–12 MB.
> - Lý do chính: bộ cài nhỏ, tốn ít RAM hơn Electron nhiều, backend Rust nhanh và an toàn bộ nhớ, UI web có sẵn nhiều thư viện tốt (shadcn/ui, dnd-kit).
> - Stack đã gọn theo phạm vi bản gọn: không nhắc nhở, không khay hệ thống, không phím tắt toàn cục, không đa ngôn ngữ (chỉ tiếng Việt), không biểu đồ.
> - Phiên bản tra ngày 2026-09-12, nguồn ở [§7](#7-nguồn-tra-cứu-phiên-bản). Đã duyệt 2 lựa chọn: Biome thay ESLint, dnd-kit bản "legacy" ổn định, với điều kiện đạt mục tiêu hiệu năng ở [05](05-kien-truc.md) và đúng thiết kế UI ở [04](04-thiet-ke-ui.md).
> - Máy dev còn thiếu Rust và MSVC Build Tools. Cách cài ở [§5](#5-chuẩn-bị-môi-trường).

---

## 1. Bảng stack

### 1.1 Vỏ desktop và backend (Rust)

| Thành phần | Phiên bản | Vai trò | Lý do chọn |
|---|---|---|---|
| Rust (toolchain `stable-msvc`) | 1.98.1 | Ngôn ngữ backend | Bắt buộc với Tauri. sqlx 0.9 yêu cầu MSRV 1.94 |
| Tauri | 2.11.5 | Khung app desktop, IPC, cửa sổ | Bộ cài nhỏ, dùng WebView2 có sẵn trên Windows, mô hình quyền (capabilities) chặt |
| @tauri-apps/cli / @tauri-apps/api | 2.11.4 / 2.11.1 | CLI build + API JS | Đi kèm Tauri |
| tauri-bundler (NSIS) | 2.9.4 | Tạo bộ cài `.exe` | Mặc định của Tauri, cài không cần quyền admin (`currentUser`) |
| sqlx (feature `sqlite`, `runtime-tokio`, `migrate`, `macros`) | 0.9.0 | Truy cập SQLite, migration nhúng (`sqlx::migrate!`) | Truy vấn runtime (`sqlx::query`), không cần ORM |
| tokio | 1.x (bản mới nhất lúc dựng khung) | Runtime async | Tauri đã dùng sẵn |
| serde / serde_json | 1.x | Dữ liệu IPC, `manifest.json` của file sao lưu | Chuẩn de-facto |
| thiserror | 2.x | Định nghĩa `AppError` có mã lỗi | Chuẩn de-facto |
| tracing (+ tracing-subscriber, tracing-appender) | 0.1.x | Ghi log ra file | Chẩn đoán lỗi offline |
| chrono | 0.4.x (xác nhận ở M0) | Ngày theo giờ máy: "hôm nay", quá hạn, "tuần này", 30 ngày thùng rác | Cần múi giờ máy trong Rust |
| (Không dùng) tauri-specta | — | — | IPC viết tay `dto.rs` ⇄ `types.ts` ([05](05-kien-truc.md)), tránh phụ thuộc bản RC |
| tauri-plugin-single-instance | 2.4.3 | Chặn mở 2 tiến trình, lần mở thứ 2 focus cửa sổ cũ | Tránh 2 tiến trình cùng ghi một DB |
| tauri-plugin-window-state | 2.4.1 | Nhớ vị trí/kích thước cửa sổ | Plugin chính thức |
| tauri-plugin-dialog | 2.7.2 | Chọn tệp đính kèm, chọn nơi lưu / chọn file `.zip` khôi phục | Plugin chính thức. Chỉ gọi từ Rust |
| tauri-plugin-opener | 2.5.4 | Mở tệp đính kèm bằng ứng dụng mặc định của Windows | Chỉ gọi từ Rust, chỉ với tệp nằm trong thư mục `attachments` của app ([05](05-kien-truc.md)) |
| zip | xác nhận ở M0 | Tạo/đọc file sao lưu `.zip` (DB + tệp đính kèm + `manifest.json`) | Sao lưu phải gồm cả tệp đính kèm, không chỉ file DB |
| sha2 · uuid | xác nhận ở M0 | SHA-256 của file DB ghi trong `manifest.json` để kiểm tra khi khôi phục · tên file lưu trữ của tệp đính kèm | Crate chuẩn, không phụ thuộc hệ thống |

### 1.2 Giao diện (TypeScript)

| Thành phần | Phiên bản | Vai trò | Lý do chọn |
|---|---|---|---|
| Node.js | 24 (đã có) | Chạy tooling | Máy dev đã có |
| pnpm (dòng 11) | 11.26.0 | Quản lý package | pnpm 12 (ra 26/08/2026) còn quá mới. Dòng 11 được hỗ trợ tới 30/04/2027 |
| React | 19.3.0 | UI | Đã chốt |
| TypeScript | 7.0.2 (`strict`) | Kiểu tĩnh, `tsc --noEmit` để type-check | Compiler viết lại bằng Go, nhanh ~10 lần. **Chưa có programmatic API**, stack này không cần API đó. Nếu công cụ nào cần: cài song song `@typescript/typescript6` |
| Vite | 8.3.0 | Dev server + build (Rolldown) | Nhanh, Tauri hỗ trợ sẵn. Một entry `index.html` |
| Tailwind CSS | 4.3.3 (`@tailwindcss/vite`) | Styling, token màu sáng/tối | Đã chốt. v4 cấu hình bằng CSS |
| shadcn/ui (CLI `shadcn`) | 4.13.1 | Bộ component (copy vào repo): Dialog, Select, Table, Tabs, DatePicker… | **Lưu ý:** từ 07/2026 dự án mới mặc định dùng Base UI. Khởi tạo bằng `shadcn init --base radix` để giữ Radix. Từ 09/2026 component import `cn` từ package `cn` |
| lucide-react | 1.44.0 | Icon | Đi kèm shadcn |
| sonner | xác nhận ở M0 | Thông báo (toast) | Đi kèm shadcn/ui |
| @fontsource/nunito | 5.x (xác nhận ở M0) | Font Nunito đóng gói sẵn (subset latin, latin-ext, vietnamese) | App offline nên không tải từ Google Fonts |
| @dnd-kit/core | 6.3.1 | Kéo thẻ Kanban giữa 5 cột trạng thái | Chỉ cần `core` (draggable/droppable): thẻ tự sắp theo hạn nên không cần `sortable`. `@dnd-kit/react` 0.5.0 còn beta (rủi ro R7) |
| @tanstack/react-query | 5.102.8 | Cache dữ liệu lấy qua IPC, làm mới sau mỗi thao tác ghi | Đã chốt |
| @tanstack/react-router | 1.170.35 | Định tuyến có kiểu, khai báo route bằng code (`src/app/router.tsx`) | Kiểm tra kiểu cho params/search params (`?task=id`, bộ lọc) |
| zustand | 5.0.15 | Trạng thái UI nhỏ (bộ lọc đang chọn, chế độ Kanban/Danh sách) | Đã chốt |
| date-fns | 4.4.0 (locale `vi`) | Định dạng ngày ở giao diện | Đã chốt. v5 mới ở alpha |
| Biome **(thay ESLint + Prettier)** | 2.5.13 | Lint + format TS/JSON/CSS | typescript-eslint cần TS API, mà TS 7 chưa có. Biome là một binary, cấu hình một file |
| Vitest + Testing Library | Vitest 5.0 (ra 03/09/2026) | Test UI | Cùng pipeline với Vite |

> Quy tắc phiên bản: `Cargo.toml` và `package.json` ghi đúng bản ở trên. Các bản khác dùng `^` và khoá bằng `Cargo.lock`/`pnpm-lock.yaml`. Nâng cấp làm thành một thay đổi riêng.
>
> Không dùng: thư viện biểu đồ, danh sách ảo (virtualization), i18n, trình soạn Markdown, thư viện animation. Mô tả việc là văn bản thuần.

## 2. Các phương án đã cân nhắc và loại

| Phương án | Ưu điểm | Lý do loại |
|---|---|---|
| **Electron** | Hệ sinh thái lớn, toàn bộ bằng JS | Đóng gói cả Chromium + Node: bộ cài ~80–150 MB, RAM lúc rảnh 200–400 MB. Quá nặng cho một app nhỏ |
| **.NET WPF / WinUI 3** | Native Windows, tooling Visual Studio mạnh | Làm UI hiện đại (Kanban kéo thả, sáng/tối) tốn công hơn React + shadcn. WinUI 3 còn vướng đóng gói/triển khai |
| **Python + PySide6 (Qt)** | Viết nhanh | Bộ cài lớn (60–150 MB), khởi động chậm, antivirus hay báo nhầm file PyInstaller |
| **Flutter (Windows)** | UI đẹp, một codebase | Không tận dụng được hệ UI web (shadcn). Phải học Dart |
| **Tauri 2 (đã chọn)** | Bộ cài ~5–12 MB, RAM thấp, Rust an toàn và nhanh, UI web đầy đủ | Phải học Rust. Phụ thuộc WebView2 (Win11 có sẵn) |

## 3. Cơ sở dữ liệu: vì sao SQLite

**Lý do:** SQLite nhúng thẳng vào app, không có tiến trình server. Toàn bộ dữ liệu là một file. Với một người dùng, đọc/ghi cục bộ là nhanh nhất. Sao lưu: `VACUUM INTO` ra một bản chụp DB rồi nén cùng thư mục tệp đính kèm thành `.zip`. Người dùng không phải cài thêm gì.

| DB | Vì sao KHÔNG chọn |
|---|---|
| PostgreSQL / MySQL / MariaDB | Cần cài và chạy service riêng, quản lý user/port. Thừa cho 1 người dùng offline |
| SQL Server (Express / LocalDB) | Cài nặng, cần quyền admin hoặc MSI riêng, không có driver Rust tốt |
| DuckDB | Tối ưu cho phân tích (OLAP), không hợp với nhiều ghi nhỏ như tạo/sửa việc |
| **SQLite (chọn)** | Nhúng, một file, không server, giao dịch ACID, WAL, sao lưu đơn giản |

PRAGMA: `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000`. File DB: `%APPDATA%\<identifier>\quanlytask.db` (`app_data_dir()` của Tauri). Chi tiết 8 bảng ở [03](03-co-so-du-lieu.md).

## 4. Đóng gói và phân phối

| Hạng mục | Quyết định | Giải thích |
|---|---|---|
| Định dạng | NSIS `.exe` (`bundle.targets = ["nsis"]`) | Theo brief. Không làm MSI |
| Chế độ cài | `installMode: "currentUser"` | Cài vào `%LOCALAPPDATA%`, **không cần quyền admin**, không hiện UAC |
| WebView2 | `webviewInstallMode: "embedBootstrapper"` | Nhúng bootstrapper (~1,8 MB). Máy thiếu WebView2 (hiếm, Windows 10 cũ) thì bộ cài tự tải. Windows 11 luôn có sẵn |
| Tên app / Identifier | Tên **Quản lý Task** (đã chốt). Identifier `vn.personal.quanlytask` **(đã chốt 12/09)**; hiện chưa phát hành nên vẫn đổi được, sau bản phát hành đầu tiên thì không | Identifier quyết định thư mục dữ liệu. **Không được đổi sau khi phát hành** |
| Cập nhật | Cài đè bằng bộ cài bản mới | Không dùng updater. Dữ liệu trong `%APPDATA%` giữ nguyên. Lần mở đầu sau cập nhật: tự sao lưu DB rồi chạy migration |
| Code-signing | Không bắt buộc ở v1 | Xem rủi ro R2 |

## 5. Chuẩn bị môi trường

Máy dev hiện có Node 24, npm 11, Git, WebView2. Làm lần lượt trong PowerShell:

| Bước | Lệnh / thao tác | Kiểm tra |
|---|---|---|
| 1. VS Build Tools 2022 | `winget install Microsoft.VisualStudio.2022.BuildTools`, trong Visual Studio Installer tick workload **"Desktop development with C++"** (MSVC v143 + Windows 11 SDK) | `cl` chạy được trong "Developer PowerShell for VS 2022" |
| 2. Rust | `winget install --id Rustlang.Rustup`, sau đó `rustup default stable-msvc` | `rustc -V` → 1.98.x |
| 3. Thành phần Rust | `rustup component add rustfmt clippy` | `cargo clippy -V` |
| 4. pnpm | `npm i -g pnpm@11`, pin bằng trường `packageManager` trong `package.json` | `pnpm -v` → 11.x |
| 5. sqlx-cli | `cargo install sqlx-cli --no-default-features --features sqlite` | `sqlx --version` → 0.9.x |
| 6. Editor | VS Code + rust-analyzer, Tauri, Biome, Tailwind CSS IntelliSense | — |

Lần build Rust đầu mất 3–8 phút, các lần sau nhanh hơn nhiều.

## 6. Rủi ro kỹ thuật và cách giảm

| # | Rủi ro | Mức | Cách giảm |
|---|---|---|---|
| R1 | **WebView2** thiếu hoặc lỗi thời trên máy cũ | Thấp | `embedBootstrapper`. Win11 luôn có, WebView2 tự cập nhật qua Windows Update |
| R2 | **SmartScreen** cảnh báo do chưa ký số | Trung bình (chỉ gây phiền) | v1 chấp nhận: hướng dẫn *More info → Run anyway*. Nếu phát hành rộng: chứng chỉ OV hoặc Azure Artifact Signing (`signCommand`). Từ 2024 chứng chỉ EV không còn cho uy tín SmartScreen ngay |
| R3 | **Antivirus báo nhầm** bộ cài chưa ký | Trung bình | Không nén UPX, giữ script NSIS mặc định. Quét VirusTotal trước mỗi bản phát hành. Bị báo nhầm thì gửi mẫu cho Microsoft Defender |
| R4 | **Cập nhật khi offline**, không có auto-update | Thấp | Cài đè bằng bộ cài mới. Migration chỉ thêm, tự sao lưu DB trước khi migrate |
| R5 | (Đã loại) tauri-specta còn bản RC | — | Không dùng: IPC viết tay `dto.rs` ⇄ `types.ts` ([05](05-kien-truc.md)) |
| R6 | **TypeScript 7 chưa có API**, vài công cụ chưa tương thích | Thấp | Stack đã tránh công cụ cần API. Dự phòng: `@typescript/typescript6` hoặc quay về TS 6.0.3 |
| R7 | **dnd-kit legacy** không còn phát hành mới | Thấp | Kéo thả chỉ dùng ở một chỗ (Kanban, kéo giữa cột), bọc trong `features/projects/kanban/`. Thử với React 19 ở M0 (nửa ngày). Hỏng thì đổi thư viện chỉ động vào thư mục đó |
| R8 | Dev mới với Rust → chậm tiến độ | Trung bình | Backend mỏng, nghiệp vụ gom ở `services`. Ước lượng ở [06](06-quy-trinh-phat-trien.md) đã cộng thời gian học |
| R9 | **Mất dữ liệu** do lỗi migration, hỏng file, khôi phục nhầm | Thấp, hậu quả cao | WAL + `synchronous=NORMAL`. Tự sao lưu trước migrate và trước khi khôi phục. Khôi phục kiểm tra `manifest.json`, SHA-256 và `PRAGMA integrity_check` trước khi thay dữ liệu |
| R10 | Tệp đính kèm làm thư mục dữ liệu và file `.zip` lớn, sao lưu chậm | Thấp | Tối đa 50 MB mỗi tệp. Tệp đính kèm đưa vào zip ở chế độ không nén lại (`Stored`). Sao lưu/khôi phục chạy trong `spawn_blocking`, UI hiện trạng thái "Đang sao lưu…" |

## 7. Nguồn tra cứu phiên bản

Tra ngày 2026-09-12. Tauri 2.11.5 và React 19.3.0 do chủ dự án xác nhận sẵn.

- Tauri và plugin (tauri 2.11.5, cli 2.11.4, bundler 2.9.4, single-instance 2.4.3, window-state 2.4.1, dialog 2.7.2, opener 2.5.4): https://v2.tauri.app/release/
- @tauri-apps/api 2.11.1: https://www.npmjs.com/package/@tauri-apps/api
- WebView2 install mode và NSIS installMode: https://v2.tauri.app/distribute/windows-installer/
- Ký số Windows / SmartScreen: https://v2.tauri.app/distribute/sign/windows/
- Yêu cầu môi trường Windows: https://v2.tauri.app/start/prerequisites/
- Rust 1.98.1: https://blog.rust-lang.org/2026/09/03/Rust-1.98.1/
- sqlx 0.9.0 (MSRV 1.94): https://github.com/launchbadge/sqlx/blob/main/CHANGELOG.md · https://docs.rs/crate/sqlx/latest
- Vite 8.3.0: https://github.com/vitejs/vite/releases · https://vite.dev/blog/announcing-vite8
- TypeScript 7.0.2 và ghi chú về API: https://github.com/microsoft/typescript/releases · https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Tailwind CSS 4.3.3: https://github.com/tailwindlabs/tailwindcss/releases
- shadcn CLI 4.13.1, Base UI mặc định, `--base radix`, package `cn`: https://www.npmjs.com/package/shadcn · https://ui.shadcn.com/docs/changelog · https://ui.shadcn.com/docs/cli
- lucide-react 1.44.0: https://www.npmjs.com/package/lucide-react
- @dnd-kit/core 6.3.1, @dnd-kit/react 0.5.0 beta: https://www.npmjs.com/package/@dnd-kit/core · https://www.npmjs.com/package/@dnd-kit/react · https://github.com/clauderic/dnd-kit/discussions/1842
- TanStack Query 5.102.8: https://www.npmjs.com/package/@tanstack/react-query
- TanStack Router 1.170.35: https://www.npmjs.com/package/@tanstack/react-router
- Zustand 5.0.15: https://www.npmjs.com/package/zustand
- date-fns 4.4.0: https://www.npmjs.com/package/date-fns · https://github.com/date-fns/date-fns/releases
- Biome 2.5.13: https://github.com/biomejs/biome/releases
- Vitest 5.0: https://vitest.dev/blog
- pnpm (dòng 11 = 11.26.0, dòng 12): https://endoflife.date/pnpm · https://pnpm.io/blog/releases/11.0
