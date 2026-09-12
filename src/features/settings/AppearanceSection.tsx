import type { Theme } from "@/shared/api/types";
import { useTheme } from "@/shared/lib/theme";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { SROW } from "./styles";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
  { value: "system", label: "Theo hệ thống" },
];

/** Giao diện Sáng / Tối / Theo hệ thống (lưu qua update_settings trong useTheme). */
export function AppearanceSection() {
  const { theme, resolved, setTheme } = useTheme();
  return (
    <>
      <div className={SROW}>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="font-extrabold text-sm">Chế độ màu</span>
          <span className="text-[12.5px] text-muted leading-normal">
            {theme === "system"
              ? `Theo cài đặt của Windows · hiện đang: ${resolved === "dark" ? "Tối" : "Sáng"}`
              : "Đổi nhanh được bằng nút sáng/tối ở thanh trên."}
          </span>
        </div>
        <ToggleGroup
          type="single"
          spacing={1}
          value={theme}
          onValueChange={(v) => v && setTheme(v as Theme)}
          aria-label="Chế độ màu"
          className="rounded-nav bg-surface p-1"
        >
          {OPTIONS.map((o) => (
            <ToggleGroupItem
              key={o.value}
              value={o.value}
              className="h-[30px] rounded-[10px] px-3 font-extrabold text-[13px] text-muted hover:text-ink data-[state=on]:bg-surface2 data-[state=on]:text-ink data-[state=on]:shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
            >
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <span className="text-[12.5px] text-muted">
        Thay đổi có hiệu lực ngay, không cần khởi động lại app.
      </span>
    </>
  );
}
