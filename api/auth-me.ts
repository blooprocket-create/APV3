import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asyncHandler } from "../lib/utils.js";
import { getSessionUser } from "../lib/auth.js";

export default asyncHandler(async (req: VercelRequest, res: VercelResponse) => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(200).json({ user: null });
    return;
  }
  res.status(200).json({ user });
});

