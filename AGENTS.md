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
