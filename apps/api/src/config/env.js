import dotenv from "dotenv";

dotenv.config();

const rawPaymentsMode = String(process.env.PAYMENTS_MODE ?? "stripe")
  .trim()
  .toLowerCase();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? "dev_jwt_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "2h",
  platformAdminSecret:
    process.env.PLATFORM_ADMIN_SECRET ?? "dev_platform_admin_secret_change_me",
  paymentsMode: rawPaymentsMode === "stripe" ? "stripe" : "demo",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  sql: {
    server: process.env.SQL_SERVER ?? "localhost",
    port: Number(process.env.SQL_PORT ?? 1433),
    database: process.env.SQL_DATABASE ?? "FundNest",
    user: process.env.SQL_USER ?? "sa",
    password: process.env.SQL_PASSWORD ?? "Your_strong_password123"
  }
};
