import { useEffect, useState } from "react";

/**
 * Tra ve `value` sau khi no NGUNG doi trong `delay` ms — go "noi com dien" ma moi
 * phim mot request la 12 request, 11 cai vut di va an rate-limit oan.
 *
 * clearTimeout trong cleanup la phan quan trong nhat: thieu no thi timer cu van no
 * va van gui request cua gia tri cu.
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
