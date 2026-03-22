import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const token = authHeader.slice(7).trim();
    const payload = jwt.verify(token, env.jwtSecret);

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_token" });
  }
}
