import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler, requireMethod } from "../lib/utils";
import { clearAuthCookie } from "../lib/auth";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (!requireMethod(req, res, ["POST"])) return;
  clearAuthCookie(res);
  res.status(200).json({ success: true });
});
