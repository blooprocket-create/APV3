import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler } from "../lib/utils.js";
import { query } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const id = req.query.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  const user = await requireAuth(req);

  const requestResult = await query<{
    id: string;
    user_id: string;
    service_id: string;
    status: string;
    brief: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    service_title: string;
    service_slug: string;
    customer_name: string;
    customer_email: string;
  }>(
    `SELECT sr.id, sr.user_id, sr.service_id, sr.status, sr.brief, sr.created_at, sr.updated_at,
            s.title AS service_title, s.slug AS service_slug,
            u.name AS customer_name, u.email AS customer_email
     FROM service_requests sr
     JOIN services s ON sr.service_id = s.id
     JOIN users u ON sr.user_id = u.id
     WHERE sr.id = $1`,
    [id]
  );

  const serviceRequest = requestResult.rows[0];
  if (!serviceRequest) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const isOwner = serviceRequest.user_id === user.id;
  const canView = isOwner || user.role === "admin" || user.role === "editor";
  if (!canView) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const messages = await query(
    `SELECT m.id, m.body, m.attachments, m.created_at AS "createdAt",
            sender.id AS "senderId", sender.name AS "senderName", sender.role AS "senderRole"
     FROM messages m
     JOIN users sender ON m.sender_user_id = sender.id
     WHERE m.service_request_id = $1
     ORDER BY m.created_at ASC`,
    [id]
  );

  const quote = await query(
    `SELECT id, amount_cents AS "amountCents", notes, status, created_at AS "createdAt"
     FROM quotes
     WHERE service_request_id = $1`,
    [id]
  );

  const deliverables = await query(
    `SELECT id, title, description, file_url AS "fileUrl", created_at AS "createdAt"
     FROM deliverables
     WHERE service_request_id = $1
     ORDER BY created_at DESC`,
    [id]
  );

  res.status(200).json({
    request: {
      id: serviceRequest.id,
      status: serviceRequest.status,
      brief: serviceRequest.brief,
      createdAt: serviceRequest.created_at,
      updatedAt: serviceRequest.updated_at,
      service: {
        id: serviceRequest.service_id,
        title: serviceRequest.service_title,
        slug: serviceRequest.service_slug
      },
      customer: {
        id: serviceRequest.user_id,
        name: serviceRequest.customer_name,
        email: serviceRequest.customer_email
      },
      messages: messages.rows,
      quote: quote.rows[0] ?? null,
      deliverables: deliverables.rows
    }
  });
});
