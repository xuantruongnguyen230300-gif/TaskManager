import { cn } from "@/shared/lib/utils";

/** Dự án = ô vuông màu (không dùng nền màu cho dự án — docs/04 §2). */
export function ProjectDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-3 flex-none rounded-[4px]", className)}
      style={{ background: color }}
    />
  );
}

/** Ô vuông màu + tên dự án. */
export function ProjectLabel({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <ProjectDot color={color} />
      <span className="truncate text-[13px] font-bold">{name}</span>
    </span>
  );
}
