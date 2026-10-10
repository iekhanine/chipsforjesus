# Prayer Wall fix (V11)

This addresses Vite on localhost:5173 not serving Vercel API endpoints. The homepage first tries `/api/public-prayers`, then loads only published wall entries directly from Supabase when that endpoint is unavailable or empty.

1. Ensure the 20 prayers were seeded using `PRAYER_WALL_ADMIN_MIGRATION.sql`.
2. Run `PRAYER_WALL_PUBLIC_READ_FIX.sql` in Supabase SQL Editor.
3. Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) are set in `.env.local`.
4. Restart Vite and reload the homepage.

The SQL read policy only exposes `c4j_wall_entries` where `visible = true`. Customer prayer/order records are not made public.
