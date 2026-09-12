import { useMatch, useNavigate } from "@tanstack/react-router";
import { Moon, Plus, Search, Sun } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTheme } from "@/shared/lib/theme";
import { useUiStore } from "@/shared/stores/ui";
import { Button } from "@/shared/ui/button";

/** Thanh trên: ô tìm (Enter → /tasks?q=), nút Sáng/Tối, nút "Thêm việc" (mở SC-4). */
export function TopBar() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { resolved, setTheme } = useTheme();
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  const projectMatch = useMatch({ from: "/projects/$projectId", shouldThrow: false });
  const tasksMatch = useMatch({ from: "/tasks", shouldThrow: false });
  // Đang ở màn Công việc: ô tìm luôn phản ánh `?q=` (sửa/xoá ở ô tìm trong trang thì ô này cũng đổi).
  const routeQ = tasksMatch ? (tasksMatch.search.q ?? "") : undefined;

  useEffect(() => {
    if (routeQ !== undefined) setQ(routeQ);
  }, [routeQ]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim() || undefined;
    if (tasksMatch) {
      // Giữ nguyên các bộ lọc khác đang chọn, chỉ đổi từ khoá.
      navigate({ to: "/tasks", search: (prev) => ({ ...prev, q: term }) });
    } else {
      navigate({ to: "/tasks", search: term ? { q: term } : {} });
    }
  };

  const dark = resolved === "dark";

  return (
    <div className="flex flex-none items-center gap-3">
      <form
        onSubmit={onSearch}
        className="flex h-11 flex-1 items-center gap-2.5 rounded-[22px] bg-surface px-4 text-muted shadow-card focus-within:shadow-[inset_0_0_0_1.5px_var(--focus)]"
      >
        <Search className="size-[18px] flex-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm việc theo mã hoặc tiêu đề…"
          aria-label="Tìm việc"
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-muted"
        />
      </form>
      <button
        type="button"
        onClick={() => setTheme(dark ? "light" : "dark")}
        title="Đổi giao diện sáng/tối"
        aria-label="Đổi giao diện sáng/tối"
        className="flex size-11 flex-none items-center justify-center rounded-full bg-surface text-ink2 shadow-card hover:bg-surface2"
      >
        {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>
      <Button
        className="h-11 rounded-[22px] px-5"
        onClick={() => openCreateTask({ projectId: projectMatch?.params.projectId })}
      >
        <Plus />
        Thêm việc
      </Button>
    </div>
  );
}
