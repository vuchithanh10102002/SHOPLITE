// Trang thai ton kho suy ra tu so `stock` — dung chung boi product (list/detail)
// VA cart (moi item hien stockStatus). De o shared vi ca hai module can, khong
// nen bat cart import product.service (keo theo ca cloudinary). Nguong chon o
// code chu khong luu DB — chua co yeu cau cau hinh theo tung san pham.
export type StockStatus = "in_stock" | "low" | "out";

const LOW_STOCK_THRESHOLD = 5;

export function stockStatusOf(stock: number): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "in_stock";
}
