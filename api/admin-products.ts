import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody } from "../lib/utils.js";
import { productInputSchema } from "../lib/validators.js";
import { query } from "../lib/db.js";
import { requireAuth, ensureAnyRole } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  const user = await requireAuth(req);
  ensureAnyRole(user, ["admin", "editor"]);

  if (req.method === "GET") {
    const result = await query(
      `SELECT id, slug, title, description, price_cents AS "priceCents", is_active AS "isActive",
              sku, tags, cover_image_url AS "coverImageUrl", digital_file_url AS "digitalFileUrl",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM products
       ORDER BY created_at DESC`
    );
    res.status(200).json({ products: result.rows });
    return;
  }

  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const parsed = productInputSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const existing = await query(`SELECT id FROM products WHERE slug = $1`, [data.slug]);
    if (existing.rowCount > 0) {
      res.status(409).json({ error: "Slug already exists" });
      return;
    }

    const inserted = await query(
      `INSERT INTO products (slug, title, description, price_cents, is_active, sku, tags, cover_image_url, digital_file_url)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), $6, COALESCE($7::text[], '{}'), $8, $9)
       RETURNING id, slug, title`,
      [
        data.slug,
        data.title,
        data.description,
        data.priceCents,
        data.isActive ?? null,
        data.sku ?? null,
        data.tags ?? null,
        data.coverImageUrl ?? null,
        data.digitalFileUrl ?? null
      ]
    );

    res.status(201).json({ product: inserted.rows[0] });
    return;
  }

  res.status(405).json({ error: "Method Not Allowed" });
});

