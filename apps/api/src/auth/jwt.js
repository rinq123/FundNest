import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      tenantSlug: user.tenantSlug
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
