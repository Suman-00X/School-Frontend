import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { isApiError } from "@/common/api";
import { AuthProvider } from "@/common/auth";
import { AcademicYearProvider } from "@/common/academic-year/AcademicYearProvider";
import { ConfirmProvider, ToastProvider } from "@/common/ui";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      /* 4xx never retries (403, 404, 409, 422 are answers, not glitches) */
      retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 2
    },
    mutations: { retry: false }
  }
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AcademicYearProvider>
          <ToastProvider>
            <ConfirmProvider>
              <RouterProvider router={router} />
            </ConfirmProvider>
          </ToastProvider>
        </AcademicYearProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
