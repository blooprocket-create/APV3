import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, rateLimit, getUserAgentKey, readJsonBody, requireMethod } from "../lib/utils.js";
import { loginSchema } from "../lib/validators.js";
import { verifyPassword, signToken, setAuthCookie } from "../lib/auth.js";
import { query } from "../lib/db.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;

  const limiterKey = `login:${getUserAgentKey(req)}`;
  if (!rateLimit(limiterKey, 10, 60_000)) {
    res.status(429).json({ error: "Too many attempts. Please try again shortly." });
    return;
  }

  const body = await readJsonBody(req);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const userResult = await query<{ id: string; password_hash: string; role: string; name: string }>(
    `SELECT id, password_hash, role, name FROM users WHERE email = $1`,
    [normalizedEmail]
  );

  const user = userResult.rows[0];
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role as any });
  setAuthCookie(res, token);

  await query(
    `INSERT INTO audit_log (actor_user_id, action, entity, entity_id, meta)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [user.id, "user.login", "user", user.id, JSON.stringify({ email: normalizedEmail })]
  ).catch(() => undefined);

  res.status(200).json({
    id: user.id,
    email: normalizedEmail,
    name: user.name,
    role: user.role
  });
});

