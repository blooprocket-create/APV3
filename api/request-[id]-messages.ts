import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody, requireMethod } from "../lib/utils.js";
import { messageCreateSchema } from "../lib/validators.js";
import { query } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;

  const id = req.query.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const user = await requireAuth(req);
  const body = await readJsonBody(req);
  const parsed = messageCreateSchema.safeParse(body);
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

  const isOwner = serviceRequest.user_id === user.id;
  const isTeam = user.role === "admin" || user.role === "editor";
  if (!isOwner && !isTeam) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { body: messageBody, attachments = [] } = parsed.data;

  const inserted = await query<{ id: string; created_at: string }>(
    `INSERT INTO messages (service_request_id, sender_user_id, body, attachments)
     VALUES ($1, $2, $3, $4::text[])
     RETURNING id, created_at`,
    [id, user.id, messageBody, attachments]
  );

  const recipientId = isOwner
    ? (await query<{ id: string }>(
        `SELECT id FROM users WHERE role IN ('admin','editor') ORDER BY created_at ASC LIMIT 1`
      )).rows[0]?.id
    : serviceRequest.user_id;

  if (recipientId) {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, meta)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        recipientId,
        "message",
        "New message on request",
        "There is a new message on your service request thread.",
        JSON.stringify({ requestId: id })
      ]
    ).catch(() => undefined);
  }

  res.status(201).json({
    message: {
      id: inserted.rows[0].id,
      createdAt: inserted.rows[0].created_at,
      body: messageBody,
      attachments,
      sender: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    }
  });
});
