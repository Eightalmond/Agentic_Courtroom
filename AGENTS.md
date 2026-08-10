# Coding agent instructions

These instructions apply to the entire repository.

- Read the relevant documentation in `docs/` before making changes.
- Keep the application deployable to Vercel Hobby.
- Do not introduce a permanently running production server. Production server functionality must use Next.js capabilities compatible with Vercel.
- Docker is for local development only.
- Use TypeScript with strict mode enabled.
- Never expose server secrets to the browser. Keep secrets out of `NEXT_PUBLIC_` variables and client components.
- Validate external inputs before using them.
- Keep changes scoped to the requested task and do not modify unrelated files.
- Add or update tests for business logic.
- Run linting, type checking, and tests before finishing. Run the production build when application or build configuration changes.
- Do not create Git commits.
- Do not push changes.
- Report changed files and any unresolved issues in the final handoff.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
