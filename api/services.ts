import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler } from "../lib/utils.js";
import { query } from "../lib/db.js";

export default asyncHandler(async (_req: VercelRequest, res: VercelResponse) => {
  const result = await query(
    `SELECT id, slug, title, description, base_price_cents AS "basePriceCents", tags
     FROM services
     WHERE is_active = TRUE
     ORDER BY created_at DESC`
  );
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).json({ services: result.rows });
});

