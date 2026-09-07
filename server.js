import "dotenv/config";
import express from "express";
import cors from "cors";

import resumesRouter from "./routes/resumes.js";
import tailorRouter from "./routes/tailor.js";
import billingRouter, { handleStripeWebhook } from "./routes/billing.js";
import queueRouter from "./routes/queue.js";
import fetchJobRouter from "./routes/fetchjob.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));

app.post("/api/billing/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.json());

app.use("/api/resumes", resumesRouter);
app.use("/api/tailor", tailorRouter);
app.use("/api/billing", billingRouter);
app.use("/api/queue", queueRouter);
app.use("/api/fetch-job", fetchJobRouter);

app.get("/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(Moonshift API listening on port ${port}));
