import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody } from "../lib/utils";
import { adminUserCreateSchema } from "../lib/validators";
import { query } from "../lib/db";
import { requireAuth, ensureRole, hashPassword } from "../lib/auth";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  const user = await requireAuth(req);
  ensureRole(user, "admin");

  if (req.method === "GET") {
    const users = await query(
      `SELECT id, email, name, role, created_at AS "createdAt"
       FROM users
       ORDER BY created_at DESC`
    );
    res.status(200).json({ users: users.rows });
    return;
  }

  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const parsed = adminUserCreateSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }

    const { email, password, name: newName, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rowCount > 0) {
      res.status(409).json({ error: "Email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const inserted = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at AS "createdAt"`,
      [normalizedEmail, passwordHash, newName, role]
    );

    res.status(201).json({ user: inserted.rows[0] });
    return;
  }

  res.status(405).json({ error: "Method Not Allowed" });
});
