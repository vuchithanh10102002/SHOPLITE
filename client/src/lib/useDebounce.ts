import { useEffect, useState } from "react";

/**
 * Tra ve `value` sau khi no NGUNG doi trong `delay` ms (Roadmap 5.1 buoc 5:
 * search debounce 400ms).
 *
 * Vi sao can: moi phim go ma ban mot request thi go "noi com dien" = 12 request,
 * 11 cai vut di — va an rate-limit oan. Debounce khien chi lan go CUOI di tiep.
 *
 * cleanup clearTimeout la phan quan trong nhat: moi lan `value` doi, timer cu bi
 * huy TRUOC khi dat timer moi. Thieu dong do thi timer cu van no → van gui request
 * cua gia tri cu.
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
