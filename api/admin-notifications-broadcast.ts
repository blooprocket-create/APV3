import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody, requireMethod } from "../lib/utils.js";
import { broadcastNotificationSchema } from "../lib/validators.js";
import { query } from "../lib/db.js";
import { requireAuth, ensureRole } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const user = await requireAuth(req);
  ensureRole(user, "admin");

  const body = await readJsonBody(req);
  const parsed = broadcastNotificationSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  const { title, body: messageBody, role } = parsed.data;

  const targets = role
    ? await query<{ id: string }>(`SELECT id FROM users WHERE role = $1`, [role])
    : await query<{ id: string }>(`SELECT id FROM users`, []);

  if (targets.rowCount === 0) {
    res.status(200).json({ inserted: 0 });
    return;
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];
  targets.rows.forEach((row: { id: string }, index: number) => {
    const base = index * 5;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb)`);
    values.push(row.id, "broadcast", title, messageBody, JSON.stringify({ role: role ?? "all" }));
  });

  await query(
    `INSERT INTO notifications (user_id, type, title, body, meta)
     VALUES ${placeholders.join(', ')}`,
    values
  );

  res.status(200).json({ inserted: targets.rowCount });
});

