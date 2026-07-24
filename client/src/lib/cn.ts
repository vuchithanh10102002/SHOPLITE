/**
 * Ghep class co dieu kien. Khong dung clsx/tailwind-merge: du an chi can bo qua
 * gia tri falsy, chua co truong hop nao thuc su phai "merge" 2 class Tailwind
 * doi nhau. Them thu vien khi nao that su gap van de do.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
