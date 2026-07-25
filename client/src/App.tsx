import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/Toaster";
import { MainLayout } from "@/layouts/MainLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { VerifyEmailPage } from "@/features/auth/pages/VerifyEmailPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";
import { HomePage } from "@/features/catalog/pages/HomePage";
import { ProductsPage } from "@/features/catalog/pages/ProductsPage";
import { ProductDetailPage } from "@/features/catalog/pages/ProductDetailPage";
import { CartPage } from "@/features/cart/pages/CartPage";
import { CheckoutPage } from "@/features/orders/pages/CheckoutPage";
import { OrdersPage } from "@/features/orders/pages/OrdersPage";
import { OrderDetailPage } from "@/features/orders/pages/OrderDetailPage";
import { DashboardPage } from "@/features/admin/dashboard/pages/DashboardPage";
import { AdminProductsPage } from "@/features/admin/products/pages/AdminProductsPage";
import { AdminProductFormPage } from "@/features/admin/products/pages/AdminProductFormPage";
import { AdminOrdersPage } from "@/features/admin/orders/pages/AdminOrdersPage";
import { AdminUsersPage } from "@/features/admin/users/pages/AdminUsersPage";
import { NotFound } from "@/pages/NotFound";

/**
 * Cay route (Roadmap 5.1 buoc 3). Hai layout song song:
 *   MainLayout — header/nav/footer, dung cho toan bo trang mua sam
 *   AuthLayout — man dang nhap/dang ky gon, khong nav gay xao nhang
 *
 * Nhom route can dang nhap boc trong <RequireAuth /> KHONG co `path`: no chi la
 * mot lop guard, khong them doan nao vao URL. Duong dan con van la /cart, /orders.
 *
 * Toaster dat NGOAI <Routes>: doi trang khong duoc lam bay thong bao dang hien.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/:slug" element={<ProductDetailPage />} />

            <Route element={<RequireAuth />}>
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>

          {/*
            Khu quan tri (Phase 6). Nam NGOAI MainLayout: sidebar rieng, khong
            header mua sam.

            `role="ADMIN"` → sai quyen thi thay trang 403, KHONG bi day ve /login
            (nguoi dung DA dang nhap roi, day ho ve login la sai thong diep va ho
            se dang nhap lai vo ich). Nhac lai cho nguoi doc sau: guard nay chi la
            UX — chan that su nam o requireRole ben backend.
          */}
          <Route element={<RequireAuth role="ADMIN" />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              {/* "new" PHAI dat TREN ":id/edit"? Khong — hai path khac hinh dang
                  (mot doan vs ba doan) nen khong dam nhau. Giu canh nhau cho de doc. */}
              <Route path="products/new" element={<AdminProductFormPage />} />
              <Route path="products/:id/edit" element={<AdminProductFormPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Routes>

        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
