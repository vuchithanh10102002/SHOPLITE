import { useEffect, useState } from "react";
import { Lock, Search, Unlock } from "lucide-react";
import { errorMessage } from "@/api/client";
import { useDebounce } from "@/lib/useDebounce";
import { useUrlFilters } from "@/lib/useUrlFilters";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/features/auth/store";
import { Button } from "@/components/ui/Button";
import { SELECT_CLASS } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/Modal";
import { EmptyRow, SkeletonRows, Table, Td, Th } from "@/components/ui/Table";
import { ErrorState } from "@/components/ui/States";
import { useAdminUsers, useSetUserStatus } from "../hooks";
import type { AdminUser, Role } from "@/api/types";

const COLS = 6;

export function AdminUsersPage() {
  const { params, patch, clear } = useUrlFilters();
  const me = useAuthStore((s) => s.user);

  const q = params.get("q") ?? "";
  const role = (params.get("role") as Role | null) ?? "";
  const isActive = params.get("isActive") ?? "";
  const page = Number(params.get("page")) || 1;

  const [search, setSearch] = useState(q);
  const debounced = useDebounce(search, 400);

  useEffect(() => {
    if (debounced !== q) patch({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- patch doc params moi lan render
  }, [debounced]);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  const query = useAdminUsers({
    q: q || undefined,
    role: role || undefined,
    // Chuoi "true"/"false" chu KHONG phai boolean: backend doc query string va
    // co y so khop chuoi tuong minh (Boolean("false") === true la bay da biet).
    isActive: isActive === "true" || isActive === "false" ? isActive : undefined,
    page,
  });

  const setStatus = useSetUserStatus();
  const [pending, setPending] = useState<AdminUser | null>(null);

  const items = query.data?.data ?? [];
  const meta = query.data?.meta;

  function confirmToggle() {
    if (!pending) return;
    const next = !pending.isActive;

    setStatus.mutate(
      { id: pending.id, isActive: next },
      {
        onSuccess: () => {
          setPending(null);
          toast.success(next ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản");
        },
        onError: (error) => {
          setPending(null);
          toast.error(errorMessage(error, "Không đổi được trạng thái tài khoản"));
        },
      },
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Người dùng</h1>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo email hoặc họ tên…"
            aria-label="Tìm người dùng"
            className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={role}
          onChange={(e) => patch({ role: e.target.value })}
          aria-label="Lọc theo vai trò"
          className={SELECT_CLASS}
        >
          <option value="">Mọi vai trò</option>
          <option value="CUSTOMER">Khách hàng</option>
          <option value="ADMIN">Quản trị viên</option>
        </select>

        <select
          value={isActive}
          onChange={(e) => patch({ isActive: e.target.value })}
          aria-label="Lọc theo trạng thái tài khoản"
          className={SELECT_CLASS}
        >
          <option value="">Mọi trạng thái</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Đã khóa</option>
        </select>

        {(q || role || isActive) && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Xóa bộ lọc
          </Button>
        )}
      </div>

      <div className="mt-4">
        {query.isError ? (
          <ErrorState
            message={errorMessage(query.error, "Không tải được danh sách người dùng")}
            onRetry={() => query.refetch()}
          />
        ) : (
          <Table className={cn(query.isFetching && "opacity-60 transition-opacity")}>
            <thead>
              <tr>
                <Th>Người dùng</Th>
                <Th>Vai trò</Th>
                <Th>Email</Th>
                <Th className="text-right">Số đơn</Th>
                <Th>Tham gia</Th>
                <Th className="text-right">Trạng thái</Th>
              </tr>
            </thead>

            <tbody>
              {query.isPending ? (
                <SkeletonRows cols={COLS} />
              ) : items.length === 0 ? (
                <EmptyRow colSpan={COLS}>Không có người dùng nào khớp bộ lọc.</EmptyRow>
              ) : (
                items.map((u) => {
                  const isAdmin = u.role === "ADMIN";

                  return (
                    <tr key={u.id} className={cn("hover:bg-gray-50", !u.isActive && "bg-gray-50/60")}>
                      <Td>
                        <div className="font-medium text-gray-900">{u.fullName}</div>
                        <div className="max-w-[16rem] truncate text-xs text-gray-500">{u.email}</div>
                      </Td>

                      <Td>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            isAdmin ? "bg-primary-light text-primary" : "bg-gray-100 text-gray-600",
                          )}
                        >
                          {isAdmin ? "Quản trị viên" : "Khách hàng"}
                          {u.id === me?.id && " (bạn)"}
                        </span>
                      </Td>

                      <Td>
                        <span
                          className={cn(
                            "text-xs",
                            u.emailVerified ? "text-emerald-700" : "text-amber-700",
                          )}
                        >
                          {u.emailVerified ? "Đã xác thực" : "Chưa xác thực"}
                        </span>
                      </Td>

                      <Td className="text-right tabular-nums">{u.orderCount}</Td>
                      <Td className="whitespace-nowrap text-gray-500">{formatDateTime(u.createdAt)}</Td>

                      <Td>
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              u.isActive ? "text-emerald-700" : "text-red-600",
                            )}
                          >
                            {u.isActive ? "Hoạt động" : "Đã khóa"}
                          </span>

                          {/* KHONG co nut xoa (du lieu user con duoc don hang tham
                              chieu), va tai khoan ADMIN thi khong khoa duoc — backend
                              tra 409 CANNOT_LOCK_ADMIN. Disable o day de nguoi dung
                              khong bam vao mot nut chac chan that bai. */}
                          <Button
                            variant={u.isActive ? "danger" : "secondary"}
                            size="sm"
                            disabled={isAdmin}
                            title={
                              isAdmin
                                ? "Không thể khóa tài khoản quản trị viên"
                                : u.isActive
                                  ? "Khóa tài khoản"
                                  : "Mở khóa tài khoản"
                            }
                            onClick={() => setPending(u)}
                          >
                            {u.isActive ? (
                              <Lock className="size-4" aria-hidden />
                            ) : (
                              <Unlock className="size-4" aria-hidden />
                            )}
                            {u.isActive ? "Khóa" : "Mở"}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        )}

        {meta && (
          <Pagination
            meta={meta}
            disabled={query.isFetching}
            onChange={(next) => {
              patch({ page: String(next) }, false);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        danger={pending?.isActive === true}
        title={pending?.isActive ? "Khóa tài khoản?" : "Mở khóa tài khoản?"}
        confirmLabel={pending?.isActive ? "Khóa" : "Mở khóa"}
        loading={setStatus.isPending}
        onCancel={() => setPending(null)}
        onConfirm={confirmToggle}
        message={
          pending?.isActive ? (
            <>
              <b>{pending?.fullName}</b> ({pending?.email}) sẽ không đăng nhập được nữa và mọi phiên
              đang mở bị thu hồi. Đơn hàng cũ của họ vẫn giữ nguyên.
            </>
          ) : (
            <>
              <b>{pending?.fullName}</b> ({pending?.email}) sẽ đăng nhập và mua hàng lại được.
            </>
          )
        }
      />
    </div>
  );
}
