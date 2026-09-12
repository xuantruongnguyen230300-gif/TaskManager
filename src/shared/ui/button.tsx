import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Nút theo docs/04: tròn hai đầu, cao 40px (sm 32px), chữ 800.
 * variant: default (nút chính, nền đậm — mỗi màn/hộp thoại chỉ một) · secondary (nền phụ) ·
 * outline (viền mảnh) · ghost (trong suốt) · destructive (nền đỏ nhạt, chữ đỏ) · link.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-extrabold outline-none transition-[background-color,opacity,box-shadow] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-btn text-btn-ink hover:opacity-90",
        secondary: "bg-surface2 text-ink hover:bg-pill",
        outline:
          "bg-transparent text-ink2 shadow-[inset_0_0_0_1.5px_var(--line)] hover:bg-surface2",
        ghost: "bg-transparent text-ink2 hover:bg-surface2",
        destructive: "bg-danger-bg text-danger hover:opacity-90",
        link: "h-auto px-0 text-hero-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[18px] text-sm",
        sm: "h-8 px-3.5 text-[13px] [&_svg:not([class*='size-'])]:size-[15px]",
        lg: "h-11 px-5 text-sm",
        icon: "size-10",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-[15px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type = "button",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
