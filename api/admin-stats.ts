import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler } from "../lib/utils";
import { query } from "../lib/db";
import { requireAuth, ensureRole } from "../lib/auth";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const user = await requireAuth(req);
  ensureRole(user, "editor");

  const usersCount = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users`);
  const productsCount = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM products`);
  const servicesCount = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM services`);
  const openRequests = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM service_requests WHERE status IN ('open','needs_info','quoted','in_progress')`
  );
  const paidRevenue = await query<{ total: string | null }>(
    `SELECT SUM(total_cents)::text AS total FROM orders WHERE status = 'paid'`
  );

  const recentOrders = await query(
    `SELECT id, total_cents AS "totalCents", status, type, created_at AS "createdAt"
     FROM orders
     ORDER BY created_at DESC
     LIMIT 5`
  );

  res.status(200).json({
    stats: {
      users: Number(usersCount.rows[0].count),
      products: Number(productsCount.rows[0].count),
      services: Number(servicesCount.rows[0].count),
      openRequests: Number(openRequests.rows[0].count),
      mockRevenueCents: Number(paidRevenue.rows[0].total ?? "0")
    },
    recentOrders: recentOrders.rows
  });
});
