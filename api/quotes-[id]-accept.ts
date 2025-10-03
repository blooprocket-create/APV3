import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, requireMethod } from "../lib/utils";
import { query, transaction } from "../lib/db";
import { requireAuth } from "../lib/auth";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;

  const id = req.query.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const user = await requireAuth(req);

  const result = await transaction(async (client) => {
    const quoteResult = await client.query<{
      id: string;
      service_request_id: string;
      amount_cents: number;
      status: string;
      notes: string | null;
      user_id: string;
      service_id: string;
      service_title: string;
    }>(
      `SELECT q.id, q.service_request_id, q.amount_cents, q.status, q.notes,
              sr.user_id, sr.service_id,
              s.title AS service_title
       FROM quotes q
       JOIN service_requests sr ON q.service_request_id = sr.id
       JOIN services s ON sr.service_id = s.id
       WHERE q.id = $1`,
      [id]
    );

    const quote = quoteResult.rows[0];
    if (!quote) {
      const err = new Error("Quote not found");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    if (quote.user_id !== user.id) {
      const err = new Error("Forbidden");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    if (quote.status !== "sent" && quote.status !== "draft") {
      const err = new Error("Quote cannot be accepted in current state");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    await client.query(`UPDATE quotes SET status = 'accepted' WHERE id = $1`, [id]);

    const insertedOrder = await client.query<{ id: string }>(
      `INSERT INTO orders (user_id, status, total_cents, type, service_request_id)
       VALUES ($1, 'pending', $2, 'service', $3)
       RETURNING id`,
      [user.id, quote.amount_cents, quote.service_request_id]
    );

    const orderId = insertedOrder.rows[0].id;

    await client.query(
      `INSERT INTO order_items (order_id, service_id, title, unit_price_cents, quantity, subtotal_cents)
       VALUES ($1, $2, $3, $4, 1, $4)`,
      [orderId, quote.service_id, quote.service_title, quote.amount_cents]
    );

    await client.query(
      `UPDATE service_requests SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
      [quote.service_request_id]
    );

    return { orderId, requestId: quote.service_request_id, serviceTitle: quote.service_title };
  });

  const message = `${user.name} accepted a quote for ${result.serviceTitle}.`;

  await query(
    `INSERT INTO notifications (user_id, type, title, body, meta)
     SELECT id, $1, $2, $3, $4::jsonb
     FROM users
     WHERE role IN ('admin', 'editor')
     LIMIT 10`,
    [
      "quote",
      "Quote accepted",
      message,
      JSON.stringify({ requestId: result.requestId, orderId: result.orderId })
    ]
  ).catch(() => undefined);

  res.status(200).json({ orderId: result.orderId, requestId: result.requestId });
});
