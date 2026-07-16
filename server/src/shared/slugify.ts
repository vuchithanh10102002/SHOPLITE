/**
 * Chuan hoa text tieng Viet — dung cho slug (Category/Product) va cot
 * `name_normalized` phuc vu search bo dau (roadmap Phase 3, muc 3.2).
 *
 * Hai dau ra khac nhau tu cung mot phep bo dau:
 *   normalizeText("Áo Thun Nam")  → "ao thun nam"   (giu space → search `contains`)
 *   slugify("Áo Thun Nam")        → "ao-thun-nam"   (gach noi → URL)
 */

// Dai combining diacritical marks U+0300..U+036F — cac dau roi ra sau khi NFD tach.
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * NFD tach "á" thanh "a" + dau sac roi (U+0301), regex xoa cac dau roi do.
 *
 * Nhung "đ" (U+0111) la MOT ky tu doc lap, khong phai "d" + dau — NFD khong tach
 * duoc, phai replace tay. Quen buoc nay thi "Đồng hồ" ra slug "-ong-ho".
 */
export function removeDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Bo dau + lowercase + gop khoang trang thua. Dung cho `name_normalized`. */
export function normalizeText(input: string): string {
  return removeDiacritics(input).toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Tra ve chuoi RONG neu input khong con ky tu [a-z0-9] nao (vd: "!!!", "日本").
 * Chu goi phai tu lo fallback — helper khong tu bia slug thay nguoi dung.
 */
export function slugify(input: string): string {
  return normalizeText(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
