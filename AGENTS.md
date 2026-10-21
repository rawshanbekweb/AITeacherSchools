# Notes for coding agents

- Next.js 16: APIs differ from older versions — read `node_modules/next/dist/docs/` before changing routing,
  caching or config. `middleware` is now `src/proxy.ts`; `params`/`searchParams`/`cookies()` are async.
- All authorization lives on the server: `src/lib/server/crud.ts` (entity rules + tenant scope) and
  `src/lib/server/classroom.ts`. Never rely on hidden UI for access control.
- Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and commit the new file in `drizzle/`.
- Before pushing: `npx next typegen && npm run typecheck && npm run lint && npm test && npm run build`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
