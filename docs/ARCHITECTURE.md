# Architecture

## Current architecture

The current repository is a single Next.js application using the App Router, React, TypeScript in strict mode, and Tailwind CSS. The homepage and controlled FlowPilot product routes are statically renderable and contain no server integrations. Test creation, run detail, and the retrieval playground add bounded client-side interaction without an API. Project configuration, product-content integrity, run business rules, and retrieval behavior are covered by Vitest, while ESLint and the TypeScript compiler provide automated checks.

FlowPilot product knowledge is stored as readonly, typed TypeScript data under `lib/product/`. A deterministic lookup utility resolves page slugs. `/product` renders the complete knowledge index, and `/product/[slug]` renders each page from the same local data source. Static parameters are generated for the known slugs, related-page links are validated in tests, and unknown slugs return a product-specific not-found state.

Keeping this first product local and deterministic provides a stable fixture for later retrieval and synthetic-customer phases. It avoids external content drift, network dependencies, a CMS, and any interaction with a real product.

Predefined tasks, personas, and run types are stored as readonly TypeScript data under `lib/test-runs/`. Run creation validates task IDs, persona IDs, and the action range before generating a URL-safe ID with the platform crypto API. The `/tests/new` client flow creates a `ready` run, and `/runs/[id]` resolves that run after browser hydration.

Browser persistence is isolated in a dedicated module with a versioned storage key. Parsed records pass an explicit type guard before use, malformed records are ignored safely, and stored data is normalized so internal evaluation material is not persisted. Browser APIs are never accessed during server rendering.

> localStorage provides zero-cost, Vercel-compatible persistence for the early MVP, but runs are not shared across devices and can be lost when browser data is cleared.

Deterministic retrieval is implemented as pure TypeScript under `lib/retrieval/`. The search index derives one stable record per FlowPilot section and includes its source page metadata, body, keywords, callouts, and related slugs. No facts are copied into a separate hand-maintained index. `/retrieval` imports the pure functions directly, and run pages query them with the selected customer question; no Route Handler or server action is involved.

Normalization lowercases text, removes common punctuation, collapses whitespace, removes duplicate tokens, and excludes a small explicit stop-word set. Bounded synonym groups cover known FlowPilot terminology only. Fixed weights favor exact title phrases, then exact body phrases, direct title and metadata matches, direct body matches, and finally lower-scored synonym matches. A multi-term bonus rewards sections that cover several direct query terms. Equal scores are ordered by page slug and stable section ID.

> Deterministic lexical retrieval is inexpensive, inspectable, and easy to test, but it handles paraphrases less effectively than embedding-based semantic retrieval. The MVP starts with deterministic retrieval so ranking behavior can be evaluated before adding model-dependent complexity.

Embedding and vector search are deliberately deferred. There is no RAG pipeline or agent in the current architecture; Phase 4 provides only the local retrieval component a later agent may call.

The app runs directly with Node.js 22 and npm. Docker Compose provides a local development convenience only: it runs the Next.js development server, mounts the source directory for hot reloading, and preserves container dependencies in a named volume. Production deployment targets Vercel Hobby through the normal Next.js build flow.

There is currently:

- no database;
- no authentication;
- no file storage or uploads;
- no AI provider integration;
- no custom API or Route Handler.

There is no database or server-side run persistence. The only run persistence is browser-specific localStorage.

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
