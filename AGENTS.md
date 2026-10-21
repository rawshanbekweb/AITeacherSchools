# Notes for coding agents

- Next.js 16: APIs differ from older versions — read `node_modules/next/dist/docs/` before changing routing,
  caching or config. `middleware` is now `src/proxy.ts`; `params`/`searchParams`/`cookies()` are async.
- All authorization lives on the server: `src/lib/server/crud.ts` (entity rules + tenant scope) and
  `src/lib/server/classroom.ts`. Never rely on hidden UI for access control.
- Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and commit the new file in `drizzle/`.
- Before pushing: `npx next typegen && npm run typecheck && npm run lint && npm test && npm run build`.
