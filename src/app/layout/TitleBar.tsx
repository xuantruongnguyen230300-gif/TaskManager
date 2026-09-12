import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** Gọi API cửa sổ; chạy ngoài Tauri (pnpm dev trên trình duyệt) thì bỏ qua. */
function withWindow(action: (w: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
  try {
    action(getCurrentWindow()).catch(() => {});
  } catch {
    // không có Tauri
  }
}

function WindowButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-11 items-center justify-center text-muted outline-none transition-colors hover:bg-surface2 focus-visible:outline-offset-[-2px]",
        danger && "hover:bg-[#E5484D] hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

/** Thanh tiêu đề tự vẽ (decorations: false): kéo để di chuyển, nhấp đúp để phóng to. */
export function TitleBar() {
  return (
    <div data-tauri-drag-region className="flex h-8 flex-none select-none justify-end">
      <WindowButton label="Thu nhỏ" onClick={() => withWindow((w) => w.minimize())}>
        <Minus className="size-[13px]" strokeWidth={1.6} />
      </WindowButton>
      <WindowButton label="Phóng to" onClick={() => withWindow((w) => w.toggleMaximize())}>
        <Square className="size-3" strokeWidth={1.6} />
      </WindowButton>
      <WindowButton label="Đóng" danger onClick={() => withWindow((w) => w.close())}>
        <X className="size-[14px]" strokeWidth={1.6} />
      </WindowButton>
    </div>
  );
}
