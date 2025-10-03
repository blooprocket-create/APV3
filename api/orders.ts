import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody } from "../lib/utils.js";
import { orderCreateSchema } from "../lib/validators.js";
import { query, transaction } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === "GET") {
    const user = await requireAuth(req);
    const mine = req.query.mine === "1" || user.role === "customer";

    const orders = await query(
      `SELECT o.id, o.total_cents AS "totalCents", o.status, o.type, o.created_at AS "createdAt",
              o.service_request_id AS "serviceRequestId",
              COALESCE(json_agg(json_build_object(
                'id', oi.id,
                'title', oi.title,
                'unitPriceCents', oi.unit_price_cents,
                'quantity', oi.quantity,
                'subtotalCents', oi.subtotal_cents,
                'productId', oi.product_id,
                'serviceId', oi.service_id
              ) ORDER BY oi.title) FILTER (WHERE oi.id IS NOT NULL), '[]'::json) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${mine ? 'WHERE o.user_id = $1' : ''}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 50`,
      mine ? [user.id] : []
    );

    res.status(200).json({ orders: orders.rows });
    return;
  }

  if (req.method === "POST") {
    const user = await requireAuth(req);
    const body = await readJsonBody(req);
    const parsed = orderCreateSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }

    const { items, type } = parsed.data;

    const detailedItems: {
      productId?: string;
      serviceId?: string;
      title: string;
      unitPriceCents: number;
      quantity: number;
      subtotal: number;
    }[] = [];

    for (const item of items) {
      if (!item.productId && !item.serviceId) {
        res.status(400).json({ error: "Each item must reference a product or service" });
        return;
      }
      if (item.productId && item.serviceId) {
        res.status(400).json({ error: "Item cannot reference both product and service" });
        return;
      }

      if (item.productId) {
        const productResult = await query<{
          id: string;
          title: string;
          price_cents: number;
          is_active: boolean;
        }>(
          `SELECT id, title, price_cents, is_active FROM products WHERE id = $1`,
          [item.productId]
        );
        const product = productResult.rows[0];
        if (!product || !product.is_active) {
          res.status(404).json({ error: "Product not found" });
          return;
        }
        detailedItems.push({
          productId: product.id,
          title: product.title,
          unitPriceCents: product.price_cents,
          quantity: item.quantity,
          subtotal: product.price_cents * item.quantity
        });
      } else if (item.serviceId) {
        const serviceResult = await query<{
          id: string;
          title: string;
          base_price_cents: number;
          is_active: boolean;
        }>(
          `SELECT id, title, base_price_cents, is_active FROM services WHERE id = $1`,
          [item.serviceId]
        );
        const service = serviceResult.rows[0];
        if (!service || !service.is_active) {
          res.status(404).json({ error: "Service not found" });
          return;
        }
        detailedItems.push({
          serviceId: service.id,
          title: service.title,
          unitPriceCents: service.base_price_cents,
          quantity: item.quantity,
          subtotal: service.base_price_cents * item.quantity
        });
      }
    }

    const totalCents = detailedItems.reduce((sum, item) => sum + item.subtotal, 0);

    const order = await transaction(async (client) => {
      const insertedOrder = await client.query<{ id: string }>(
        `INSERT INTO orders (user_id, status, total_cents, type)
         VALUES ($1, 'pending', $2, $3)
         RETURNING id`,
        [user.id, totalCents, type]
      );

      const orderId = insertedOrder.rows[0].id;

      for (const item of detailedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, service_id, title, unit_price_cents, quantity, subtotal_cents)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            orderId,
            item.productId ?? null,
            item.serviceId ?? null,
            item.title,
            item.unitPriceCents,
            item.quantity,
            item.subtotal
          ]
        );
      }

      return { id: orderId };
    });

    res.status(201).json({
      order: {
        id: order.id,
        totalCents,
        status: "pending",
        type,
        items: detailedItems
      }
    });
    return;
  }

  res.status(405).json({ error: "Method Not Allowed" });
});

