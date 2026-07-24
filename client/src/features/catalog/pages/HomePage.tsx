import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useCategories, useProducts } from "../hooks";
import { ProductCard } from "../components/ProductCard";
import { buttonClass } from "@/components/ui/Button";
import { ProductCardSkeleton } from "@/components/ui/States";

/**
 * Trang chu: mot khoi gioi thieu + loi tat danh muc + 8 san pham moi nhat.
 *
 * KHONG bat loi rieng o day: khac trang /products (noi danh sach LA noi dung
 * chinh), o trang chu day chi la khoi phu — QueryCache.onError da toast mot dong
 * la du, dung dung ErrorState do loe giua trang chu.
 */
export function HomePage() {
  const products = useProducts({ sort: "newest", limit: 8 });
  const categories = useCategories();

  const items = products.data?.data ?? [];

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-primary px-6 py-10 text-white sm:px-10 sm:py-14">
        <h1 className="max-w-xl text-2xl font-semibold sm:text-3xl">
          Mua sắm gọn nhẹ, giao hàng tận nơi
        </h1>
        <p className="mt-3 max-w-xl text-primary-light">
          ShopLite — cửa hàng trực tuyến với đầy đủ giỏ hàng, thanh toán và theo dõi đơn hàng.
        </p>
        <Link to="/products" className={buttonClass("secondary", "lg", "mt-6")}>
          Xem tất cả sản phẩm
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>

      {categories.data && categories.data.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Danh mục</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.data.map((c) => (
              <Link
                key={c.id}
                // Loc bang categoryId chu khong phai slug: backend nhan categoryId
                // (listProductQuerySchema), va day cung la tham so ProductsPage doc.
                to={`/products?categoryId=${c.id}`}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-primary hover:text-primary"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Mới nhất</h2>
          <Link to="/products" className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.isPending
            ? Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)
            : items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  );
}
