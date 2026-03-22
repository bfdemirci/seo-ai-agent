import express from "express";
import { loginAdmin } from "../auth/authService.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "email_and_password_required" });
    }

    const result = await loginAdmin({ email, password });

    if (!result.ok) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    res.json({
      success: true,
      token: result.token,
      user: result.user
    });
  } catch (err) {
    console.error("auth login error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
