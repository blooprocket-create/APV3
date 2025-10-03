import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, readJsonBody } from "../lib/utils.js";
import { adminUserUpdateSchema } from "../lib/validators.js";
import { query } from "../lib/db.js";
import { requireAuth, ensureRole, hashPassword } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  const user = await requireAuth(req);
  ensureRole(user, "admin");

  const id = req.query.id;
  if (!id || typeof id !== "string") {
    res.status(400).json({ error: "Missing id" });
    return;
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
      return;
    }

    const updates = parsed.data;

    if (updates.email) {
      const normalized = updates.email.toLowerCase();
      const exists = await query(`SELECT id FROM users WHERE email = $1 AND id <> $2`, [normalized, id]);
      if ((exists.rowCount ?? 0) > 0) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.email) {
      fields.push(`email = $${fields.length + 1}`);
      values.push(updates.email.toLowerCase());
    }
    if (updates.name) {
      fields.push(`name = $${fields.length + 1}`);
      values.push(updates.name);
    }
    if (updates.role) {
      fields.push(`role = $${fields.length + 1}`);
      values.push(updates.role);
    }
    if (updates.password) {
      const passwordHash = await hashPassword(updates.password);
      fields.push(`password_hash = $${fields.length + 1}`);
      values.push(passwordHash);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "No updates provided" });
      return;
    }

    values.push(id);

    const updated = await query<{ id: string; email: string; name: string; role: string; createdAt: string }>(
      `UPDATE users SET ${fields.join(", ")}
       WHERE id = $${fields.length + 1}
       RETURNING id, email, name, role, created_at AS "createdAt"`,
      values
    );

    if (!updated.rows[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.status(200).json({ user: updated.rows[0] });
    return;
  }

  if (req.method === "DELETE") {
    if (id === user.id) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }
    await query(`DELETE FROM users WHERE id = $1`, [id]);
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method Not Allowed" });
});
