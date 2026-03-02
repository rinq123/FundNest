import { verifyToken } from "../auth/jwt.js";

function readBearerToken(authHeader) {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export function requireAuth(req, res, next) {
  try {
    const token = readBearerToken(req.header("authorization"));

    if (!token) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const claims = verifyToken(token);
    req.auth = claims;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.auth?.role;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}

export function requireTenantScope(req, res, next) {
  const tenantId = req.auth?.tenantId;

  if (!tenantId) {
    return res.status(403).json({ error: "Tenant scope missing in token" });
  }

  req.tenantId = tenantId;
  return next();
}
