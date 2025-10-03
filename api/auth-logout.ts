import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, requireMethod } from "../lib/utils.js";
import { clearAuthCookie } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;
  clearAuthCookie(res);
  res.status(200).json({ success: true });
});

