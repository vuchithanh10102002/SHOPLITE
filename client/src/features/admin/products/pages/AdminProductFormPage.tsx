import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { errorMessage } from "@/api/client";
import { toast } from "@/lib/toast";
import { flattenCategories, useCategories } from "@/features/catalog/hooks";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState, Spinner } from "@/components/ui/States";
import { useAdminProduct, useCreateProduct, useUpdateProduct } from "../hooks";
import { productFormSchema, toPayload, type ProductFormValues } from "../schemas";
import { ImageManager } from "../components/ImageManager";

/**
 * MOT trang cho ca tao lan sua — phan biet bang co `:id` tren URL hay khong.
 * Hai trang rieng se la hai ban sao cua cung mot form, va cai thu hai luon quen
 * mot field khi ai do them cot moi.
 *
 * Anh chi quan ly duoc o che do SUA: upload la hai buoc (tao san pham → co id →
 * dinh anh). Trang tao xong se DIEU HUONG sang trang sua chu khong quay ve bang,
 * de admin dinh anh ngay khi con nho minh vua tao cai gi.
 */
export function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const categories = useCategories();
  const detail = useAdminProduct(id ?? "");
  const create = useCreateProduct();
  const update = useUpdateProduct(id ?? "");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    // Gia tri khoi tao cho che do TAO. Che do sua do lai bang reset() ben duoi —
    // defaultValues chi doc MOT LAN luc mount, luc do query detail chua ve.
    defaultValues: { name: "", categoryId: "", price: 0, stock: 0, description: "" },
  });

  /**
   * Do du lieu vao form DUNG MOT LAN cho moi san pham.
   *
   * `reset()` moi lan `detail.data` doi la mot cai bay that: upload xong mot tam
   * anh → invalidate → detail refetch → data la object moi → reset() → MOI thay
   * doi admin dang go do (ten, gia, mo ta) bi xoa sach ma khong ai bao. Ref chot
   * theo id nen doi sang san pham khac van do lai binh thuong.
   */
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!detail.data) return;
    if (hydratedFor.current === detail.data.id) return;
    hydratedFor.current = detail.data.id;

    reset({
      name: detail.data.name,
      categoryId: detail.data.category.id,
      // price la CHUOI tu backend (Decimal) — form so can number.
      price: Number(detail.data.price),
      stock: detail.data.stock,
      description: detail.data.description ?? "",
    });
  }, [detail.data, reset]);

  async function onSubmit(values: ProductFormValues) {
    try {
      if (isEdit && id) {
        await update.mutateAsync(toPayload(values, "update"));
        toast.success("Đã lưu thay đổi");
      } else {
        const created = await create.mutateAsync(toPayload(values, "create"));
        toast.success("Đã tạo sản phẩm — thêm ảnh cho nó ngay bên dưới");
        navigate(`/admin/products/${created.id}/edit`, { replace: true });
      }
    } catch (error) {
      // Backend van la chot cuoi: ten trung slug, danh muc khong ton tai, gia
      // vuot Decimal(12,2)... deu tra 400/404/409 voi message tieng Viet.
      toast.error(errorMessage(error, "Không lưu được sản phẩm"));
    }
  }

  if (isEdit && detail.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (isEdit && detail.isError) {
    return (
      <ErrorState
        message={errorMessage(detail.error, "Không tải được sản phẩm")}
        onRetry={() => detail.refetch()}
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <Link to="/admin/products" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="size-4" aria-hidden />
        Danh sách sản phẩm
      </Link>

      <h1 className="mt-2 text-xl font-semibold">
        {isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm"}
      </h1>

      {isEdit && detail.data?.deletedAt && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sản phẩm này đang ở trạng thái <b>đã xóa</b> nên khách không nhìn thấy. Sửa vẫn được, nhưng
          phải khôi phục ở danh sách thì nó mới hiện lại trong cửa hàng.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <Input label="Tên sản phẩm" error={errors.name?.message} {...register("name")} />

        <Select label="Danh mục" error={errors.categoryId?.message} {...register("categoryId")}>
          <option value="">— Chọn danh mục —</option>
          {flattenCategories(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Giá (VND)"
            type="number"
            step="0.01"
            min="0"
            error={errors.price?.message}
            // valueAsNumber: khong co no, react-hook-form tra CHUOI "100000" va
            // z.number() rot ngay — form khong bao gio gui duoc.
            {...register("price", { valueAsNumber: true })}
          />

          <Input
            label="Tồn kho"
            type="number"
            step="1"
            min="0"
            error={errors.stock?.message}
            {...register("stock", { valueAsNumber: true })}
          />
        </div>

        <Textarea label="Mô tả" rows={5} error={errors.description?.message} {...register("description")} />

        <div className="flex justify-end gap-2">
          <Link
            to="/admin/products"
            className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Hủy
          </Link>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Lưu thay đổi" : "Tạo sản phẩm"}
          </Button>
        </div>
      </form>

      {isEdit && id && detail.data && (
        <div className="mt-4">
          <ImageManager productId={id} images={detail.data.images} />
        </div>
      )}

      {!isEdit && (
        <p className="mt-4 text-sm text-gray-500">
          Tạo sản phẩm xong sẽ chuyển sang màn sửa để thêm ảnh — API cần id của sản phẩm mới đính
          được ảnh vào.
        </p>
      )}
    </div>
  );
}
