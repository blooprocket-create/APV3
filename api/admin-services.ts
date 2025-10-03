import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody } from "../lib/utils.js";
import { serviceInputSchema } from "../lib/validators.js";
import { query } from "../lib/db.js";
import { requireAuth, ensureAnyRole } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  const user = await requireAuth(req);
  ensureAnyRole(user, ["admin", "editor"]);

  if (req.method === "GET") {
    const services = await query(
      `SELECT id, slug, title, description, base_price_cents AS "basePriceCents",
              is_active AS "isActive", tags, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM services
       ORDER BY created_at DESC`
    );
    res.status(200).json({ services: services.rows });
    return;
  }

  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const parsed = serviceInputSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const existing = await query(`SELECT id FROM services WHERE slug = $1`, [data.slug]);
    if (existing.rowCount > 0) {
      res.status(409).json({ error: "Slug already exists" });
      return;
    }

    const inserted = await query(
      `INSERT INTO services (slug, title, description, base_price_cents, is_active, tags)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE), COALESCE($6::text[], '{}'))
       RETURNING id, slug, title`,
      [
        data.slug,
        data.title,
        data.description,
        data.basePriceCents,
        data.isActive ?? null,
        data.tags ?? null
      ]
    );

    res.status(201).json({ service: inserted.rows[0] });
    return;
  }

  res.status(405).json({ error: "Method Not Allowed" });
});

