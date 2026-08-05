# Architecture

## Current architecture

The current repository is a single Next.js application using the App Router, React, TypeScript in strict mode, and Tailwind CSS. The homepage and controlled FlowPilot product routes are statically renderable and contain no server integrations. Small project configuration and product-content integrity are covered by Vitest, while ESLint and the TypeScript compiler provide automated checks.

FlowPilot product knowledge is stored as readonly, typed TypeScript data under `lib/product/`. A deterministic lookup utility resolves page slugs. `/product` renders the complete knowledge index, and `/product/[slug]` renders each page from the same local data source. Static parameters are generated for the known slugs, related-page links are validated in tests, and unknown slugs return a product-specific not-found state.

Keeping this first product local and deterministic provides a stable fixture for later retrieval and synthetic-customer phases. It avoids external content drift, network dependencies, a CMS, and any interaction with a real product.

The app runs directly with Node.js 22 and npm. Docker Compose provides a local development convenience only: it runs the Next.js development server, mounts the source directory for hot reloading, and preserves container dependencies in a named volume. Production deployment targets Vercel Hobby through the normal Next.js build flow.

There is currently:

- no database;
- no authentication;
- no file storage or uploads;
- no AI provider integration;
- no retrieval layer; and
- no custom API or Route Handler.

There are also no arbitrary document or screenshot uploads. The controlled product is repository-owned content, not user-supplied content.

## Planned architecture

Trial by User will remain a single Next.js application. User-facing routes will use App Router pages and layouts. Server functionality will be implemented with Next.js Route Handlers and server-only modules, keeping the deployment compatible with Vercel's serverless model.

The planned system boundaries are:

- **Frontend:** Next.js pages and components for setup, simulation playback, evidence review, arguments, and verdicts.
- **Server functions:** Next.js Route Handlers for validated requests, orchestration steps, and server-side provider access.
- **Persistence:** A hosted PostgreSQL service may be added later for products, test runs, evidence, and verdicts. No provider has been selected.
- **Product knowledge:** The local FlowPilot fixture remains the deterministic baseline. Bounded documents and screenshots may be added later through validated upload and processing flows; arbitrary uploads are not part of the current architecture.
- **Simulation orchestration:** Simulations will be divided into short, retryable, serverless-compatible steps rather than one long-running request.
- **Secrets:** API keys and service credentials will remain server-side and will never be placed in browser-exposed environment variables.
- **Deployment:** Vercel will host the production Next.js application. Docker Compose will remain a local-development tool.

No permanently running backend process or Docker-only production architecture will be required. If a future feature cannot fit within serverless execution limits, its design must be revisited before implementation rather than introducing an unmanaged long-running server.

## Request and data principles

- Validate all external inputs at the server boundary before use.
- Keep server-only dependencies and secrets out of client bundles.
- Store evidence with source references so arguments and verdicts remain auditable.
- Prefer deterministic behavior for retrieval and orchestration wherever possible.
- Keep simulation steps idempotent or safely retryable when practical.
- Add infrastructure only when a product phase requires it.
