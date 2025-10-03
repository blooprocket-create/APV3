import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody } from "../lib/utils.js";
import { productInputSchema } from "../lib/validators.js";
import { query } from "../lib/db.js";
import { requireAuth, ensureAnyRole } from "../lib/auth.js";

const updateSchema = productInputSchema.partial();

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  const user = await requireAuth(req);
  ensureAnyRole(user, ["admin", "editor"]);

  const id = req.query.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.slug) {
      const exists = await query(`SELECT id FROM products WHERE slug = $1 AND id <> $2`, [data.slug, id]);
      if (exists.rowCount > 0) {
        res.status(409).json({ error: "Slug already exists" });
        return;
      }
      fields.push(`slug = $${fields.length + 1}`);
      values.push(data.slug);
    }
    if (data.title) {
      fields.push(`title = $${fields.length + 1}`);
      values.push(data.title);
    }
    if (data.description) {
      fields.push(`description = $${fields.length + 1}`);
      values.push(data.description);
    }
    if (typeof data.priceCents === "number") {
      fields.push(`price_cents = $${fields.length + 1}`);
      values.push(data.priceCents);
    }
    if (typeof data.isActive === "boolean") {
      fields.push(`is_active = $${fields.length + 1}`);
      values.push(data.isActive);
    }
    if (data.sku !== undefined) {
      fields.push(`sku = $${fields.length + 1}`);
      values.push(data.sku ?? null);
    }
    if (data.tags !== undefined) {
      fields.push(`tags = $${fields.length + 1}::text[]`);
      values.push(data.tags ?? []);
    }
    if (data.coverImageUrl !== undefined) {
      fields.push(`cover_image_url = $${fields.length + 1}`);
      values.push(data.coverImageUrl ?? null);
    }
    if (data.digitalFileUrl !== undefined) {
      fields.push(`digital_file_url = $${fields.length + 1}`);
      values.push(data.digitalFileUrl ?? null);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "No updates provided" });
      return;
    }

    const setClause = `${fields.join(", ")}, updated_at = NOW()`;
    values.push(id);

    const updated = await query(
      `UPDATE products SET ${setClause}
       WHERE id = $${values.length}
       RETURNING id, slug, title, description, price_cents AS "priceCents", is_active AS "isActive",
                 sku, tags, cover_image_url AS "coverImageUrl", digital_file_url AS "digitalFileUrl",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );

    if (!updated.rows[0]) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.status(200).json({ product: updated.rows[0] });
    return;
  }

  if (req.method === "DELETE") {
    await query(`DELETE FROM products WHERE id = $1`, [id]);
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method Not Allowed" });
});
