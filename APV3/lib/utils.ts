import type { VercelRequest, VercelResponse } from "@vercel/node";

export const asyncHandler = <T extends (req: VercelRequest, res: VercelResponse) => Promise<unknown>>(
  fn: T
) => async (req: VercelRequest, res: VercelResponse) => {
  try {
    await fn(req, res);
  } catch (err) {
    const error = err as Error & { statusCode?: number };
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      console.error(error);
    }
    res.status(status).json({ error: error.message || "Unexpected error" });
  }
};

export const readJsonBody = async <T>(req: VercelRequest): Promise<T> => {
  if (req.body && typeof req.body === "object") {
    return req.body as T;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
};

export const requireMethod = (req: VercelRequest, res: VercelResponse, allowed: string[]) => {
  if (!allowed.includes(req.method || "")) {
    res.status(405).json({ error: "Method Not Allowed" });
    return false;
  }
  return true;
};

export const sendOk = (res: VercelResponse, data: unknown) => {
  res.status(200).json(data);
};

const rateLimitBuckets = new Map<string, { tokens: number; updatedAt: number }>();

export const rateLimit = (key: string, limit: number, refillMs: number) => {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key) ?? { tokens: limit, updatedAt: now };
  const elapsed = now - bucket.updatedAt;
  if (elapsed > refillMs) {
    bucket.tokens = limit;
    bucket.updatedAt = now;
  }
  if (bucket.tokens <= 0) {
    return false;
  }
  bucket.tokens -= 1;
  rateLimitBuckets.set(key, bucket);
  return true;
};

export const getUserAgentKey = (req: VercelRequest) => {
  return `${req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown"}:${
    req.headers["user-agent"] ?? "anonymous"
  }`;
};

export const buildCacheControl = (seconds: number) => `public, max-age=${seconds}`;
