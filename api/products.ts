import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler } from "../lib/utils.js";
import { query } from "../lib/db.js";

export default asyncHandler(async (_req: VercelRequest, res: VercelResponse) => {
  const result = await query(
    `SELECT id, slug, title, description, price_cents AS "priceCents", tags, cover_image_url AS "coverImageUrl"
     FROM products
     WHERE is_active = TRUE
     ORDER BY created_at DESC`
  );
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).json({ products: result.rows });
});

