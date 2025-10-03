import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler } from "../lib/utils.js";
import { query } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const user = await requireAuth(req);
  const mine = req.query.mine === "1" || req.query.mine === "true";

  if (!mine && user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const targetUserId = mine || user.role !== "admin" ? user.id : (req.query.userId as string | undefined) ?? user.id;

  const notifications = await query(
    `SELECT id, type, title, body, meta, read_at AS "readAt", created_at AS "createdAt"
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [targetUserId]
  );

  res.status(200).json({ notifications: notifications.rows });
});

