import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody, requireMethod } from "../lib/utils.js";
import { deliverableCreateSchema } from "../lib/validators.js";
import { query } from "../lib/db.js";
import { requireAuth, ensureAnyRole } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;

  const id = req.query.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const user = await requireAuth(req);
  ensureAnyRole(user, ["admin", "editor"]);

  const body = await readJsonBody(req);
  const parsed = deliverableCreateSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  const requestResult = await query<{ user_id: string }>(
    `SELECT user_id FROM service_requests WHERE id = $1`,
    [id]
  );
  const serviceRequest = requestResult.rows[0];
  if (!serviceRequest) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const deliverable = await query(
    `INSERT INTO deliverables (service_request_id, title, description, file_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [id, parsed.data.title, parsed.data.description ?? null, parsed.data.fileUrl]
  );

  await query(`UPDATE service_requests SET status = 'delivered', updated_at = NOW() WHERE id = $1`, [id]);

  await query(
    `INSERT INTO notifications (user_id, type, title, body, meta)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      serviceRequest.user_id,
      "deliverable",
      "New deliverable",
      "A new deliverable has been posted to your request.",
      JSON.stringify({ requestId: id, deliverableId: deliverable.rows[0].id })
    ]
  ).catch(() => undefined);

  res.status(201).json({
    deliverable: {
      id: deliverable.rows[0].id,
      createdAt: deliverable.rows[0].created_at,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      fileUrl: parsed.data.fileUrl
    }
  });
});
