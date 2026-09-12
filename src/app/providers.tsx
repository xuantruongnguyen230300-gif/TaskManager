import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { errorMessage, isAppError } from "@/shared/api/errors";
import { ThemeProvider } from "@/shared/lib/theme";
import { Toaster, toast } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { router } from "./router";

/**
 * Chỉ app ghi DB → dữ liệu không tự cũ: staleTime Infinity, không retry; làm mới bằng invalidate.
 * Lỗi mutation tự hiện toast, TRỪ lỗi VALIDATION (form tự hiện dưới trường) hoặc khi
 * mutation đặt `meta: { silentError: true }` (tự xử lý lỗi).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Number.POSITIVE_INFINITY, retry: 0, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.meta?.silentError) return;
      if (isAppError(error, "VALIDATION")) return;
      toast.error(errorMessage(error));
    },
  }),
});

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silentError?: boolean };
  }
}

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
