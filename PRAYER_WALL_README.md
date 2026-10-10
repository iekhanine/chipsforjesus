# Prayer Wall rollout

1. Run `PRAYER_WALL_MIGRATION.sql` in your existing Supabase project's SQL Editor, **before deployment**.
2. Deploy the updated source to Vercel, retaining the existing Stripe, Supabase and Jesus Admin environment variables.
3. Visit `/prayers` for the 20 starter prayers and any approved real prayers. The home page has a horizontally scrolling preview.
4. When a user buys a chip or a "Prayer for Me" prayer, they can include a note and opt into possible publication. The Stripe checkout metadata stores the opt-in, and the order row records it when the webhook or checkout claim persists the order.
5. In Jesus Admin > Prayer Queue, review an opted-in prayer, type a public reply and click Publish. Both the prayer and reply become visible to the world. Unpublish removes them from the public API. This does not post email or full customer records.

Important: The public wall displays **original submitted prayer text**. Review it for names, medical details, contact information and other sensitive information before pressing Publish. The public endpoint does not return orders without both explicit customer opt-in and admin approval. The starter prayers are authored content in `src/App.tsx`; they are not user submissions.

Testing note: This archive contains source code. Dependency installation and a full build could not be verified in the editing environment because `npm ci` did not populate the required @types packages. Run `npm ci && npm run build` in the project's working development environment before deployment.
