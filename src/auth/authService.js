import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

let cachedPasswordHash = null;

async function getPasswordHash() {
  if (cachedPasswordHash) return cachedPasswordHash;

  if (!env.adminPassword) {
    throw new Error("ADMIN_PASSWORD eksik");
  }

  cachedPasswordHash = await bcrypt.hash(env.adminPassword, 10);
  return cachedPasswordHash;
}

export async function loginAdmin({ email, password }) {
  if (!env.adminEmail) {
    throw new Error("ADMIN_EMAIL eksik");
  }

  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET eksik");
  }

  if (email !== env.adminEmail) {
    return { ok: false };
  }

  const hash = await getPasswordHash();
  const valid = await bcrypt.compare(password, hash);

  if (!valid) {
    return { ok: false };
  }

  const token = jwt.sign(
    {
      sub: env.adminEmail,
      role: "admin"
    },
    env.jwtSecret,
    { expiresIn: "7d" }
  );

  return {
    ok: true,
    token,
    user: {
      email: env.adminEmail,
      role: "admin"
    }
  };
}
