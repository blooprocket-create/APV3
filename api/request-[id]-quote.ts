import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody, requireMethod } from "../lib/utils.js";
import { quoteCreateSchema } from "../lib/validators.js";
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
  const parsed = quoteCreateSchema.safeParse(body);
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

  const { amountCents, notes } = parsed.data;

  const upserted = await query(
    `INSERT INTO quotes (service_request_id, amount_cents, notes, status)
     VALUES ($1, $2, $3, 'sent')
     ON CONFLICT (service_request_id)
     DO UPDATE SET amount_cents = EXCLUDED.amount_cents, notes = EXCLUDED.notes, status = 'sent'
     RETURNING id, status, created_at`,
    [id, amountCents, notes ?? null]
  );

  await query(`UPDATE service_requests SET status = 'quoted', updated_at = NOW() WHERE id = $1`, [id]);

  await query(
    `INSERT INTO notifications (user_id, type, title, body, meta)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      serviceRequest.user_id,
      "quote",
      "Quote ready",
      "A new quote is ready for your review.",
      JSON.stringify({ requestId: id, quoteId: upserted.rows[0].id })
    ]
  ).catch(() => undefined);

  res.status(200).json({
    quote: {
      id: upserted.rows[0].id,
      amountCents,
      notes: notes ?? null,
      status: upserted.rows[0].status,
      createdAt: upserted.rows[0].created_at
    }
  });
});
