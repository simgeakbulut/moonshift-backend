import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client, using the service role key.
// This bypasses row-level security so the backend can act on any user's data
// once it has verified who that user is.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Express middleware: expects `Authorization: Bearer <supabase-access-token>`
// (the frontend gets this token automatically from supabase-js after login).
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.user = data.user; // { id, email, ... }
  next();
}
