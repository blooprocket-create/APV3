import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody, requireMethod } from "../lib/utils";
import { requestStatusSchema } from "../lib/validators";
import { query } from "../lib/db";
import { requireAuth, ensureAnyRole } from "../lib/auth";

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
  const parsed = requestStatusSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  const updated = await query(
    `UPDATE service_requests SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id, parsed.data.status]
  );

  if (!updated.rows[0]) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  res.status(200).json({ success: true });
});
