import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler } from "../lib/utils";
import { query } from "../lib/db";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  const slug = req.query.slug;
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "Missing slug" });
    return;
  }

  const result = await query(
    `SELECT id, slug, title, description, price_cents AS "priceCents", tags,
            cover_image_url AS "coverImageUrl", digital_file_url AS "digitalFileUrl"
     FROM products
     WHERE slug = $1 AND is_active = TRUE`,
    [slug]
  );

  const product = result.rows[0];
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).json({ product });
});
