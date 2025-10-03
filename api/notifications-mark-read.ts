import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody, requireMethod } from "../lib/utils";
import { notificationReadSchema } from "../lib/validators";
import { query } from "../lib/db";
import { requireAuth } from "../lib/auth";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;

  const user = await requireAuth(req);
  const body = await readJsonBody(req);
  const parsed = notificationReadSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  const ids = parsed.data.ids;
  await query(
    `UPDATE notifications SET read_at = NOW() WHERE id = ANY($1::uuid[]) AND user_id = $2`,
    [ids, user.id]
  );

  res.status(200).json({ success: true });
});
