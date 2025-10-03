import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody, requireMethod } from "../lib/utils.js";
import { paymentMockSchema } from "../lib/validators.js";
import { transaction } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const user = await requireAuth(req);
  const body = await readJsonBody(req);
  const parsed = paymentMockSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  const { orderId } = parsed.data;

  const result = await transaction(async (client) => {
    const orderResult = await client.query<{
      id: string;
      user_id: string;
      status: string;
      type: string;
      service_request_id: string | null;
    }>(`SELECT id, user_id, status, type, service_request_id FROM orders WHERE id = $1`, [orderId]);

    const order = orderResult.rows[0];
    if (!order) {
      const err = new Error("Order not found");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    if (order.user_id !== user.id && user.role === "customer") {
      const err = new Error("Forbidden");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    if (order.status === "paid") {
      return { status: order.status, type: order.type };
    }

    await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId]);

    if (order.type === "digital") {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, meta)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          order.user_id,
          "order",
          "Digital order ready",
          "Your digital purchase is ready to download.",
          JSON.stringify({ orderId })
        ]
      );
    }

    if (order.type === "service" && order.service_request_id) {
      await client.query(
        `UPDATE service_requests SET status = 'paid', updated_at = NOW() WHERE id = $1`,
        [order.service_request_id]
      );
    }

    return { status: "paid", type: order.type };
  });

  res.status(200).json({ order: { id: orderId, status: result.status, type: result.type } });
});

