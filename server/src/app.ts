import express from "express";
import helmet from "helmet";
import cors from "cors";
import { httpLogger } from "./lib/httpLogger";
import { requestId } from "./middlewares/requestId";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { validate } from "./middlewares/validate";
import { z } from "zod";
import healthRouter from "./routes/health";
import authRoutes from "./modules/auth/auth.routes";
import categoryRoutes from "./modules/categories/category.routes";
import productRoutes from "./modules/products/product.routes";
import cookieParser from "cookie-parser";
import { env } from "./config/env";

const app = express();

// Sau Nginx, req.ip mac dinh la IP cua proxy → rate limit se gom TAT CA user
// vao chung mot counter. trust proxy cho Express doc X-Forwarded-For.
// Chi bat o production: o dev/test khong co proxy, bat len thi client tu spoof
// duoc IP bang header va di vong rate limit.
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security headers (CSP, HSTS, X-Frame-Options...). Dat truoc moi thu de ca
// response loi cung mang header bao ve.
app.use(helmet());

// Cookie httpOnly chi bay qua CORS khi credentials=true CA hai dau. origin phai
// la 1 URL cu the (khong duoc "*") khi bat credentials — trinh duyet chan "*".
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

app.use(cookieParser());

app.use(requestId);

app.use(httpLogger);

app.use("/health", healthRouter);

const schema = z.object({
    name: z.string(),
});

app.post(
    "/debug/echo",
    validate(schema),
    (req, res) => {

        res.json(req.body);

    }
);

app.use("/api/auth", authRoutes);

app.use("/api/categories", categoryRoutes);

app.use("/api/products", productRoutes);

app.use(notFound);

app.use(errorHandler);

export default app;