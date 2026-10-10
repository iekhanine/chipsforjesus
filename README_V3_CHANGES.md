# Homepage V3 updates

- The two $1 purchase cards now lead the page in a centered, highlighted purchase panel. The original cartoon hero follows as supporting brand content.
- Replaced horizontal prayer scrolling with three independent fading cards; each ~4.8 seconds one slot fades and then swaps to the next entry. Hover or keyboard focus pauses rotation; reduced motion disables rotation.
- Small screens show one rotating card instead of compressing three long quotes.
- Dedicated /prayers page retains the full static prayer list.
- No new database migration is required beyond PRAYER_WALL_MIGRATION.sql from V2.

To validate locally: `npm ci && npm run build`. This sandbox could not complete npm installation due to dependency retrieval timeout.
