import express from "express";
import { httpLogger } from "./lib/httpLogger";
import { requestId } from "./middlewares/requestId";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { validate } from "./middlewares/validate";
import { z } from "zod";
import healthRouter from "./routes/health";

const app = express();

app.use(express.json());

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

app.use(notFound);

app.use(errorHandler);

export default app;