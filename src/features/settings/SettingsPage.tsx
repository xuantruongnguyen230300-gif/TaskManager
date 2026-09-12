import { Database, type LucideIcon, Moon, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { AppearanceSection } from "./AppearanceSection";
import { DataSection } from "./DataSection";
import { ProfileSection } from "./ProfileSection";

type SectionId = "profile" | "look" | "data";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; desc: string }[] = [
  {
    id: "profile",
    label: "Hồ sơ của tôi",
    icon: User,
    desc: "Thông tin của bạn trong danh mục nhân viên, hiển thị là “Tôi”",
  },
  { id: "look", label: "Giao diện", icon: Moon, desc: "Chế độ màu sáng, tối hoặc theo Windows" },
  {
    id: "data",
    label: "Dữ liệu",
    icon: Database,
    desc: "Vị trí thư mục dữ liệu, sao lưu và khôi phục",
  },
];

/** SC-9 Cài đặt: 3 mục bên trái, nội dung mục bên phải (design/Settings.dc.html). */
export function SettingsPage() {
  const [sec, setSec] = useState<SectionId>("profile");
  const current = SECTIONS.find((s) => s.id === sec) ?? SECTIONS[0];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] gap-3.5">
      <nav className="flex flex-col gap-[3px] rounded-card bg-surface px-3 py-[18px] shadow-card">
        <h1 className="px-3 pb-3 text-[22px] text-h1">Cài đặt</h1>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={sec === s.id ? "page" : undefined}
            onClick={() => setSec(s.id)}
            className={cn(
              "flex h-10 items-center gap-3 whitespace-nowrap rounded-nav px-3 font-bold text-ink2 text-sm hover:bg-surface2",
              sec === s.id && "bg-hero font-extrabold text-hero-ink hover:bg-hero",
            )}
          >
            <s.icon className="size-[18px]" strokeWidth={2} />
            {s.label}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-card bg-surface shadow-card">
        <div className="flex flex-none flex-col gap-1 border-line border-b px-[26px] pt-5 pb-3.5">
          <div className="font-extrabold text-[20px]">{current.label}</div>
          <div className="text-sub">{current.desc}</div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[26px] pt-[18px] pb-6">
          {sec === "profile" && <ProfileSection />}
          {sec === "look" && <AppearanceSection />}
          {sec === "data" && <DataSection />}
        </div>
      </div>
    </div>
  );
}
