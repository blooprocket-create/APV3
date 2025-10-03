import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, requireMethod } from "../lib/utils";
import { query } from "../lib/db";
import { requireAuth } from "../lib/auth";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;

  const id = req.query.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const user = await requireAuth(req);

  const quoteResult = await query<{
    id: string;
    user_id: string;
    service_request_id: string;
  }>(
    `SELECT q.id, sr.user_id, sr.id AS service_request_id
     FROM quotes q
     JOIN service_requests sr ON q.service_request_id = sr.id
     WHERE q.id = $1`,
    [id]
  );

  const quote = quoteResult.rows[0];
  if (!quote) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  if (quote.user_id !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await query(`UPDATE quotes SET status = 'declined' WHERE id = $1`, [id]);
  await query(`UPDATE service_requests SET status = 'declined', updated_at = NOW() WHERE id = $1`, [quote.service_request_id]);

  const message = `${user.name} declined the quote.`;

  await query(
    `INSERT INTO notifications (user_id, type, title, body, meta)
     SELECT id, $1, $2, $3, $4::jsonb
     FROM users
     WHERE role IN ('admin', 'editor')
     LIMIT 10`,
    [
      "quote",
      "Quote declined",
      message,
      JSON.stringify({ requestId: quote.service_request_id, quoteId: id })
    ]
  ).catch(() => undefined);

  res.status(200).json({ success: true });
});
