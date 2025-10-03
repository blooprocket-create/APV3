import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody } from "../lib/utils";
import { requestCreateSchema } from "../lib/validators";
import { query } from "../lib/db";
import { requireAuth } from "../lib/auth";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === "POST") {
    const user = await requireAuth(req);
    if (user.role === "admin" || user.role === "editor") {
      res.status(403).json({ error: "Only customers can create service requests" });
      return;
    }
    const body = await readJsonBody(req);
    const parsed = requestCreateSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }
    const { serviceId, brief } = parsed.data;

    const serviceResult = await query<{ id: string }>(
      `SELECT id FROM services WHERE id = $1 AND is_active = TRUE`,
      [serviceId]
    );
    if (!serviceResult.rows[0]) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    const inserted = await query(
      `INSERT INTO service_requests (user_id, service_id, status, brief)
       VALUES ($1, $2, 'open', $3::jsonb)
       RETURNING id, status, created_at`,
      [user.id, serviceId, JSON.stringify(brief)]
    );

    res.status(201).json({
      request: {
        id: inserted.rows[0].id,
        status: inserted.rows[0].status,
        createdAt: inserted.rows[0].created_at,
        serviceId
      }
    });
    return;
  }

  if (req.method === "GET") {
    const user = await requireAuth(req);
    const mine = req.query.mine === "1" || req.query.mine === "true";
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (user.role === "customer" || mine) {
      conditions.push("sr.user_id = $1");
      params.push(user.id);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const requestsResult = await query(
      `SELECT sr.id, sr.status, sr.created_at AS "createdAt", sr.updated_at AS "updatedAt",
              sr.brief, s.title AS "serviceTitle", s.slug AS "serviceSlug",
              u.name AS "customerName", u.email AS "customerEmail"
       FROM service_requests sr
       JOIN services s ON sr.service_id = s.id
       JOIN users u ON sr.user_id = u.id
       ${whereClause}
       ORDER BY sr.created_at DESC`,
      params
    );

    res.status(200).json({ requests: requestsResult.rows });
    return;
  }

  res.status(405).json({ error: "Method Not Allowed" });
});
