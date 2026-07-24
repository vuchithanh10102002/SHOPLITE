import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { bootstrapSession } from "./api/client";

/**
 * Khoi phuc phien TRUOC khi render, o pham vi module — CO Y khong dat trong
 * useEffect.
 *
 * Ly do khong phai style: StrictMode chay effect HAI LAN o dev. Hai lan goi
 * /auth/refresh voi cung mot cookie nghia la lan thu hai gui refresh token VUA BI
 * XOAY → backend coi la "token da revoke ma van dung" = reuse detection → REVOKE
 * CA FAMILY → vua mo app da bi da ra ngoai. O pham vi module thi module chi duoc
 * eval mot lan, du StrictMode.
 *
 * `void`: khong await — app render ngay voi status "loading", RequireAuth cho san.
 */
void bootstrapSession();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
