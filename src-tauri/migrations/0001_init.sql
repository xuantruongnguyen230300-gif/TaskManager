-- 0001_init.sql — Quản lý Task, schema v0.3 (bản gọn)
-- sqlx chạy file trong 1 transaction. PRAGMA đặt ở connection (§2), không đặt ở đây.

CREATE TABLE employees (
  id             INTEGER PRIMARY KEY,
  full_name      TEXT    NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 100),
  title          TEXT,
  phone          TEXT,
  email          TEXT,
  color          TEXT    NOT NULL DEFAULT '#6E56CF',
  is_self        INTEGER NOT NULL DEFAULT 0 CHECK (is_self IN (0, 1)),
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  CHECK (is_self = 0 OR status = 'active')                           -- "Tôi" không chuyển Đã nghỉ
) STRICT;

CREATE TABLE projects (
  id           INTEGER PRIMARY KEY,
  code         TEXT    NOT NULL UNIQUE CHECK (length(code) BETWEEN 2 AND 6
                 AND code GLOB '[A-Z]*' AND code NOT GLOB '*[^A-Z0-9]*'),
  name         TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  color        TEXT    NOT NULL DEFAULT '#5B8DEF',
  next_task_no INTEGER NOT NULL DEFAULT 1 CHECK (next_task_no >= 1),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
) STRICT;

CREATE TABLE tasks (
  id              INTEGER PRIMARY KEY,
  code            TEXT    NOT NULL UNIQUE CHECK (code GLOB '[A-Z]*-[1-9]*'),
  project_id      INTEGER NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  title           TEXT    NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
  description     TEXT,
  status          TEXT    NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'in_progress', 'waiting', 'done', 'cancelled')),
  status_note     TEXT,
  priority        INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),
  assignee_id     INTEGER REFERENCES employees (id) ON DELETE RESTRICT,
  creator_id      INTEGER NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  start_date      TEXT    CHECK (start_date IS NULL OR date(start_date) IS start_date),
  due_date        TEXT    CHECK (due_date IS NULL OR date(due_date) IS due_date),
  actual_start_at INTEGER,
  actual_end_at   INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER,
  CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date),
  CHECK (actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at >= actual_start_at)
) STRICT;

CREATE TABLE subtasks (
  id       INTEGER PRIMARY KEY,
  task_id  INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  title    TEXT    NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
  is_done  INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  position INTEGER NOT NULL
) STRICT;

CREATE TABLE task_comments (
  id         INTEGER PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  body       TEXT    NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE task_attachments (
  id          INTEGER PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  file_name   TEXT    NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  stored_path TEXT    NOT NULL UNIQUE,                               -- 'attachments/<uuid>.<ext>'
  size_bytes  INTEGER NOT NULL CHECK (size_bytes BETWEEN 0 AND 52428800),
  created_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE task_history (
  id         INTEGER PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  changed_at INTEGER NOT NULL,
  field      TEXT    NOT NULL CHECK (field IN ('created', 'title', 'description', 'project', 'status',
               'priority', 'assignee', 'creator', 'start_date', 'due_date', 'actual_start', 'actual_end',
               'attachment_added', 'attachment_removed', 'deleted', 'restored')),
  old_value  TEXT,
  new_value  TEXT
) STRICT;

CREATE TABLE settings (
  key   TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
) STRICT, WITHOUT ROWID;

-- Index
CREATE UNIQUE INDEX ux_employees_self   ON employees (is_self) WHERE is_self = 1;   -- tối đa 1 "Tôi"
CREATE INDEX ix_tasks_project           ON tasks (project_id, status);
CREATE INDEX ix_tasks_assignee          ON tasks (assignee_id, status);
CREATE INDEX ix_tasks_creator           ON tasks (creator_id);                       -- kiểm FK khi xoá nhân viên
CREATE INDEX ix_tasks_due               ON tasks (due_date) WHERE deleted_at IS NULL;
CREATE INDEX ix_tasks_deleted           ON tasks (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX ix_subtasks_task           ON subtasks (task_id, position);
CREATE INDEX ix_comments_task           ON task_comments (task_id, created_at);
CREATE INDEX ix_comments_author         ON task_comments (author_id);
CREATE INDEX ix_attachments_task        ON task_attachments (task_id);
CREATE INDEX ix_history_task            ON task_history (task_id, changed_at);

-- Bảo vệ dữ liệu hệ thống (mã lỗi được Rust ánh xạ sang thông báo)
CREATE TRIGGER trg_projects_keep_default BEFORE DELETE ON projects WHEN OLD.id = 1
BEGIN SELECT RAISE(ABORT, 'PROJECT_DEFAULT_LOCKED'); END;
CREATE TRIGGER trg_employees_keep_self BEFORE DELETE ON employees WHEN OLD.is_self = 1
BEGIN SELECT RAISE(ABORT, 'SELF_LOCKED'); END;
CREATE TRIGGER trg_employees_self_fixed BEFORE UPDATE OF is_self ON employees
WHEN NEW.is_self IS NOT OLD.is_self BEGIN SELECT RAISE(ABORT, 'SELF_LOCKED'); END;
CREATE TRIGGER trg_tasks_code_fixed BEFORE UPDATE OF code ON tasks
WHEN NEW.code IS NOT OLD.code BEGIN SELECT RAISE(ABORT, 'TASK_CODE_LOCKED'); END;

-- Seed
INSERT INTO projects (id, code, name, color, next_task_no, created_at, updated_at)
VALUES (1, 'VC', 'Việc chung', '#5B8DEF', 1,
        CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
INSERT INTO employees (id, full_name, color, is_self, status, created_at, updated_at)
VALUES (1, 'Tôi', '#6E56CF', 1, 'active',
        CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
