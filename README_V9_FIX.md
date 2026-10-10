# V9 — PrayerCard homepage crash fix

- Avoid rendering PrayerCard when public prayer API returns no items.
- Guard against undefined prayer items and invalid API records.
- Limit preview cards to the number of available prayers (up to 3).
- Query wall entries and paid prayer submissions independently, so a pending migration does not suppress all available entries.
- Display a friendly empty state instead of breaking the homepage when the prayer wall is empty.

## Deployment
If you have not already done so, run PRAYER_WALL_ADMIN_MIGRATION.sql in Supabase. This is needed to load and edit the 20 starter prayers. No new migration was introduced for V9.

The test build could not run successfully here because node_modules lacks TypeScript type definitions for React, Node, estree, and json-schema. Run `npm ci && npm run build` on your machine before deployment.
