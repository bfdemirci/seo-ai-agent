import express from "express";
import { writerPipeline } from "../pipelines/writerPipeline.js";
import { requireAuth } from "../auth/authMiddleware.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: "keyword required" });
    }

    const result = await writerPipeline({ keyword });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error("generate error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
