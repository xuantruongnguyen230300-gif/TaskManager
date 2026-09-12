import { useMemo } from "react";
import { useEmployees } from "@/shared/api/queries";
import type { EmployeeRow, Id } from "@/shared/api/types";
import { Avatar } from "@/shared/ui/avatar";
import { type ComboOption, ComboPicker } from "./ComboPicker";

const UNASSIGNED = "none";

function displayName(e: EmployeeRow): string {
  return e.isSelf && e.fullName !== "Tôi" ? `${e.fullName} (Tôi)` : e.fullName;
}

function PersonOption({ name, color, sub }: { name: string | null; color?: string; sub: string }) {
  return (
    <>
      <Avatar name={name} color={color} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{name ?? "Chưa giao"}</span>
        {sub && <span className="truncate text-xs font-semibold text-muted">{sub}</span>}
      </span>
    </>
  );
}

/**
 * Chọn nhân viên (Người phụ trách, Người tạo, tác giả bình luận). Chỉ liệt kê người đang làm việc
 * (R-03); nếu giá trị hiện tại là người đã nghỉ thì vẫn giữ và hiện kèm "(đã nghỉ)".
 */
export function PersonPicker({
  value,
  onChange,
  allowUnassigned = false,
  footnote,
  invalid,
  size,
  id,
  ariaLabel,
  className,
}: {
  value: Id | null;
  onChange: (id: Id | null) => void;
  /** có mục "Chưa giao" */
  allowUnassigned?: boolean;
  footnote?: string;
  invalid?: boolean;
  size?: "default" | "sm";
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const { data: employees } = useEmployees("all");

  const options = useMemo(() => {
    const list: ComboOption[] = [];
    if (allowUnassigned) {
      list.push({
        value: UNASSIGNED,
        search: "Chưa giao",
        content: <PersonOption name={null} sub="Để trống, giao sau" />,
      });
    }
    for (const e of employees ?? []) {
      if (e.status !== "active") continue;
      list.push({
        value: String(e.id),
        search: e.fullName,
        content: <PersonOption name={displayName(e)} color={e.color} sub={e.title ?? ""} />,
      });
    }
    return list;
  }, [employees, allowUnassigned]);

  const current = value === null ? null : (employees?.find((e) => e.id === value) ?? null);

  return (
    <ComboPicker
      id={id}
      ariaLabel={ariaLabel}
      value={value === null ? (allowUnassigned ? UNASSIGNED : "") : String(value)}
      options={options}
      onSelect={(v) => onChange(v === UNASSIGNED ? null : Number(v))}
      searchPlaceholder="Tìm theo tên…"
      footnote={footnote}
      invalid={invalid}
      size={size}
      className={className}
    >
      {value === null ? (
        allowUnassigned ? (
          <>
            <Avatar name={null} />
            <span className="truncate">Chưa giao</span>
          </>
        ) : (
          <span className="truncate font-semibold text-muted">Chọn người</span>
        )
      ) : (
        <>
          <Avatar name={current?.fullName ?? null} color={current?.color} />
          <span className="truncate">
            {current ? displayName(current) : "…"}
            {current?.status === "inactive" && (
              <span className="font-semibold text-muted"> (đã nghỉ)</span>
            )}
          </span>
        </>
      )}
    </ComboPicker>
  );
}
