import express from "express";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import publicRoutes from "./routes/public.js";
import webhookRoutes from "./routes/webhooks.js";

const app = express();

app.use("/api/webhooks", express.raw({ type: "application/json" }), webhookRoutes);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "fundnest-api"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

export default app;
