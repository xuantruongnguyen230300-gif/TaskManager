import type { Id, ProjectSummary } from "@/shared/api/types";
import { ProjectDot } from "@/shared/ui/project-dot";
import { ComboPicker } from "./ComboPicker";

/** Mã việc kế tiếp của dự án ("WEB-16"); chưa biết số kế tiếp thì chỉ mã dự án. */
export function nextCodeOf(p: ProjectSummary): string | null {
  return p.nextTaskNo > 0 ? `${p.code}-${p.nextTaskNo}` : null;
}

/** Chọn dự án: ô vuông màu + tên + mã (khi tạo: mã việc kế tiếp của từng dự án). */
export function ProjectPicker({
  projects,
  value,
  onChange,
  showNextCode,
  footnote,
  invalid,
  id,
  className,
}: {
  projects: ProjectSummary[];
  value: Id | null;
  onChange: (id: Id) => void;
  showNextCode: boolean;
  footnote?: string;
  invalid?: boolean;
  id?: string;
  className?: string;
}) {
  const current = projects.find((p) => p.id === value);
  const options = projects.map((p) => ({
    value: String(p.id),
    search: `${p.name} ${p.code}`,
    content: (
      <>
        <ProjectDot color={p.color} />
        <span className="min-w-0 flex-1 truncate">{p.name}</span>
        <span className="text-code">{(showNextCode && nextCodeOf(p)) || p.code}</span>
      </>
    ),
  }));

  return (
    <ComboPicker
      id={id}
      value={value === null ? "" : String(value)}
      options={options}
      onSelect={(v) => onChange(Number(v))}
      searchPlaceholder="Tìm dự án…"
      footnote={footnote}
      invalid={invalid}
      className={className}
    >
      {current ? (
        <>
          <ProjectDot color={current.color} />
          <span className="min-w-0 flex-1 truncate">{current.name}</span>
          <span className="text-code">{current.code}</span>
        </>
      ) : (
        <span className="truncate font-semibold text-muted">Chọn dự án</span>
      )}
    </ComboPicker>
  );
}
