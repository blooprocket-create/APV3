import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, rateLimit, getUserAgentKey, readJsonBody, requireMethod } from "../lib/utils.js";
import { registerSchema } from "../lib/validators.js";
import { hashPassword, signToken, setAuthCookie } from "../lib/auth.js";
import { query } from "../lib/db.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;

  const limiterKey = `register:${getUserAgentKey(req)}`;
  if (!rateLimit(limiterKey, 5, 60_000)) {
    res.status(429).json({ error: "Too many attempts. Please try again shortly." });
    return;
  }

  const body = await readJsonBody(req);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  const { email, password, name } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rowCount > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const inserted = await query<{ id: string; role: string }>(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, role`,
    [normalizedEmail, passwordHash, name]
  );

  const user = inserted.rows[0];
  const token = signToken({ userId: user.id, role: user.role as any });
  setAuthCookie(res, token);

  await query(
    `INSERT INTO audit_log (actor_user_id, action, entity, entity_id, meta)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [user.id, "user.register", "user", user.id, JSON.stringify({ email: normalizedEmail })]
  ).catch(() => undefined);

  res.status(201).json({
    id: user.id,
    email: normalizedEmail,
    name,
    role: user.role
  });
});

