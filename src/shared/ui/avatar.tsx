import { initials } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

/** Avatar tròn chữ tắt, nền màu nhân viên, chữ trắng. `name` null = "Chưa giao" (nền xám, "?"). */
export function Avatar({
  name,
  color,
  size = "sm",
  className,
}: {
  name: string | null;
  color?: string | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  const unassigned = !name;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full font-extrabold tracking-[0.02em]",
        size === "lg" ? "size-10 text-sm" : "size-6 text-[10px]",
        unassigned ? "bg-pill text-muted" : "text-white",
        className,
      )}
      style={unassigned ? undefined : { background: color ?? "var(--muted)" }}
    >
      {unassigned ? "?" : initials(name)}
    </span>
  );
}

/** Avatar + tên; người đã nghỉ có nhãn "Đã nghỉ". */
export function PersonLabel({
  name,
  color,
  inactive = false,
  className,
}: {
  name: string | null;
  color?: string | null;
  inactive?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-[7px]", className)}>
      <Avatar name={name} color={color} />
      <span className="truncate text-[13px] font-bold">{name ?? "Chưa giao"}</span>
      {inactive && <InactiveBadge />}
    </span>
  );
}

export function InactiveBadge() {
  return (
    <span className="inline-flex h-[18px] flex-none items-center whitespace-nowrap rounded-[9px] bg-warn-bg px-[7px] text-[11px] font-extrabold text-warn">
      Đã nghỉ
    </span>
  );
}
