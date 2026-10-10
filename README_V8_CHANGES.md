# Chips for Jesus — V8

- Unified the cartoon typography, color palette, outlines and panel styling across Jesus Admin, members and authentication.
- Added the **Prayer Wall** tab in Jesus Admin with add, edit, show/hide and delete for starter/wall entries.
- The 20 seeded wall entries are now database-driven rather than hardcoded into App.tsx.
- Real customer prayers are still moderated in **Prayer Queue**; publishing/unpublishing is supported without deleting Stripe order records.

## REQUIRED DEPLOYMENT STEP
Run `PRAYER_WALL_ADMIN_MIGRATION.sql` in Supabase SQL Editor **before deploying V8**. This creates and seeds `c4j_wall_entries`. Without it, the public prayer wall API will return an error. Previous migrations remain required.

## SOURCE CAUTION
This update is based on `CFJ_UPDATED_V7.zip`, not any later manual local changes. Review/diff before replacing your working tree.
