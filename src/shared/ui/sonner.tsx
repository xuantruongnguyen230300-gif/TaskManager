import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/shared/lib/theme";

/** Toast ở cạnh dưới cửa sổ (docs/02 §9). Gọi `toast.success("Đã tạo WEB-16")`. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme();

  return (
    <Sonner
      theme={resolved}
      position="bottom-center"
      duration={3000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{ style: { fontFamily: "inherit", fontWeight: 800, fontSize: 14 } }}
      style={
        {
          "--normal-bg": "var(--btn)",
          "--normal-text": "var(--btnInk)",
          "--normal-border": "transparent",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { toast } from "sonner";
export { Toaster };
