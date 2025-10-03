import "./env";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./db";

const TOKEN_COOKIE = "session";
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set");
}

export type UserRole = "customer" | "editor" | "admin";
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

interface JwtPayload {
  userId: string;
  role: UserRole;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, jwtSecret, { expiresIn: TOKEN_MAX_AGE });

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, jwtSecret) as JwtPayload;
  } catch (err) {
    return null;
  }
};

export const setAuthCookie = (res: VercelResponse, token: string) => {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: TOKEN_MAX_AGE,
      path: "/"
    })
  );
};

export const clearAuthCookie = (res: VercelResponse) => {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(TOKEN_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 0,
      path: "/"
    })
  );
};

export const getTokenFromRequest = (req: VercelRequest) => {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) return null;
  const cookies = cookie.parse(rawCookie);
  return cookies[TOKEN_COOKIE] ?? null;
};

export const getSessionUser = async (req: VercelRequest): Promise<SessionUser | null> => {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const { rows } = await query<SessionUser>(
    "SELECT id, email, name, role, created_at FROM users WHERE id = $1",
    [payload.userId]
  );
  if (!rows[0]) return null;
  return rows[0];
};

const roleWeight: Record<UserRole, number> = {
  customer: 1,
  editor: 2,
  admin: 3
};

export const ensureRole = (user: SessionUser, minimumRole: UserRole) => {
  if (roleWeight[user.role] < roleWeight[minimumRole]) {
    const err = new Error("Forbidden");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
};

export const ensureAnyRole = (user: SessionUser, roles: UserRole[]) => {
  if (!roles.includes(user.role)) {
    const err = new Error("Forbidden");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
};

export const requireAuth = async (req: VercelRequest): Promise<SessionUser> => {
  const user = await getSessionUser(req);
  if (!user) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  return user;
};

export const respondUnauthorized = (res: VercelResponse) => {
  res.status(401).json({ error: "Unauthorized" });
};

export const respondForbidden = (res: VercelResponse) => {
  res.status(403).json({ error: "Forbidden" });
};
