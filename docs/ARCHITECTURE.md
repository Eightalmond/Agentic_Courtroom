# Architecture

## Current architecture

The current repository is a single Next.js application using the App Router, React, TypeScript in strict mode, and Tailwind CSS. The homepage and controlled FlowPilot product routes remain statically renderable. Test creation, run detail, retrieval, simulation, evidence, and independent courtroom arguments provide bounded interaction. Short Next.js Route Handlers provide the server-only synthetic-customer, evidence-collection, and advocate boundaries. Project configuration, product-content integrity, run rules, retrieval, simulation, evidence, courtroom schemas, citations, persistence, and provider errors are covered by Vitest.

FlowPilot product knowledge is stored as readonly, typed TypeScript data under `lib/product/`. A deterministic lookup utility resolves page slugs. `/product` renders the complete knowledge index, and `/product/[slug]` renders each page from the same local data source. Static parameters are generated for the known slugs, related-page links are validated in tests, and unknown slugs return a product-specific not-found state.

Keeping this first product local and deterministic provides a stable fixture for later retrieval and synthetic-customer phases. It avoids external content drift, network dependencies, a CMS, and any interaction with a real product.

Predefined tasks, personas, and run types are stored as readonly TypeScript data under `lib/test-runs/`. Run creation validates task IDs, persona IDs, and the action range before generating a URL-safe ID with the platform crypto API. The `/tests/new` client flow creates a `ready` run, and `/runs/[id]` resolves that run after browser hydration.

Browser persistence is isolated in a dedicated module with a versioned storage key. Parsed records pass strict schemas before use, malformed records are ignored safely, and legacy Phase 3 records receive simulation defaults when read. Stored data is normalized so internal evaluation material is not persisted. Browser APIs are never accessed during server rendering.

> localStorage provides zero-cost, Vercel-compatible persistence for the early MVP, but runs are not shared across devices and can be lost when browser data is cleared.

Deterministic retrieval is implemented as pure TypeScript under `lib/retrieval/`. The search index derives one stable record per FlowPilot section and includes its source page metadata, body, keywords, callouts, and related slugs. No facts are copied into a separate hand-maintained index. `/retrieval` imports the pure functions directly, and run pages query them with the selected customer question; no Route Handler or server action is involved.

Normalization lowercases text, removes common punctuation, collapses whitespace, removes duplicate tokens, and excludes a small explicit stop-word set. Bounded synonym groups cover known FlowPilot terminology only. Fixed weights favor exact title phrases, then exact body phrases, direct title and metadata matches, direct body matches, and finally lower-scored synonym matches. A multi-term bonus rewards sections that cover several direct query terms. Equal scores are ordered by page slug and stable section ID.

> Deterministic lexical retrieval is inexpensive, inspectable, and easy to test, but it handles paraphrases less effectively than embedding-based semantic retrieval. The MVP starts with deterministic retrieval so ranking behavior can be evaluated before adding model-dependent complexity.

Embedding and vector search are deliberately deferred. Phase 5 calls the deterministic retrieval component directly; it does not introduce a RAG service or vector store.

### Phase 5 simulation boundary

`POST /api/simulations/step` performs exactly one bounded agent step. The browser sends a compact snapshot containing stable task and persona IDs, counters, current content identifiers, limited recent search results, and sanitized action-history summaries. The server validates size, shape, sequential numbering, same-origin behavior, completion state, and the model-call budget before any provider access. Trusted task and persona definitions are reconstructed from repository-owned IDs, so client-supplied descriptions cannot replace them.

The server builds a compact prompt with an explicit `<untrusted_product_data>` boundary, then resolves a server-configured Groq or OpenAI provider behind one customer-decision interface. A root-object Zod schema constrains the wire response, and a second discriminated-union schema enforces the exact fields for `SEARCH`, `OPEN_PAGE`, `INSPECT_SECTION`, `ANSWER`, and `GIVE_UP`. The public explanation is length-limited plain text; raw chain-of-thought and provider traces are neither requested nor returned.

After validation, a deterministic server-owned executor resolves search, page, and section actions only against the local FlowPilot data. Unknown identifiers become recorded tool-error observations and do not trigger a second repair call. Answer and give-up actions complete the run without evaluating correctness. If the budget ends first, the run completes with a budget-exhausted outcome and no fabricated answer.

`LLM_PROVIDER` selects `groq` or `openai` and defaults to Groq for local development. Production deployments should set it explicitly. Only the selected provider's key and model are validated, and configuration is resolved only when a valid simulation step reaches the provider boundary—not during builds, static rendering, or deterministic request rejection. There is no automatic fallback.

Groq uses the existing official `openai` npm package with the fixed `https://api.groq.com/openai/v1` base URL and `responses.create`. The request supplies an explicit strict JSON Schema supported by the recommended `openai/gpt-oss-20b` model. The returned `output_text` must be exact JSON and must pass the existing Zod wire schema and exact action schema; there is no Markdown extraction, heuristic repair, or second provider call. OpenAI retains the Responses API parse path with the same Zod schemas.

Provider keys and model names are read only inside the request path from `GROQ_API_KEY`/`GROQ_MODEL` or `OPENAI_API_KEY`/`OPENAI_MODEL`. They are never sent to client code, responses, logs, or localStorage. SDK retries are disabled and requests have a short timeout. Provider authentication, rate-limit, timeout, connection, and malformed-output failures map to stable safe errors. A failed provider attempt consumes one model-call slot; safe manual retry is possible only while budget remains.

The browser applies each returned update to versioned localStorage and renders the timeline, current content, progress, and customer outcome. Auto-run is a client loop over the same endpoint. It awaits each response before issuing the next, stops on completion, error, user request, or budget exhaustion, and uses an in-flight guard to prevent duplicate simultaneous calls.

### Phase 6 evidence boundary

`POST /api/evidence/collect` receives a compact completed browser-local run and performs one short deterministic request. It accepts answer, give-up, and budget-exhausted outcomes, but rejects ready, running, malformed, unknown-task, unknown-persona, and invalid-product inputs. Evaluation specifications remain in server-only modules. The client never supplies specifications, source text, arbitrary product IDs, or expected answers.

The collector validates sequential action history and treats observation data only as references. Search observations are recomputed with the existing deterministic retrieval function; page and section identifiers are resolved against the repository-owned FlowPilot fixture. Returned excerpts and exact source text therefore come from trusted data rather than client-supplied strings. Failed tool actions are counted in integrity metadata but do not become product evidence.

Customer-seen section and page sources are de-duplicated in first-exposure order, with later exposure action numbers retained. Required unseen sources become `missing` evidence. Up to three unseen qualification, optional-supporting, or bounded retrieval sources become `context` evidence. Missing and context items can never be marked customer-seen. The collector records stable IDs, precise source locations, category coverage, visited pages, inspected sections, search queries, completion state, and integrity counts.

Six trusted task evaluation specifications define required source IDs, optional and qualification source IDs, bounded concept groups, contradictory claim markers, and exact fact-check sources. They contain no full expected answer, never enter the synthetic-customer prompt, and are not stored in localStorage. Mechanical phrase and negation checks return supported, unsupported, contradicted, or not-assessable. These values are explicitly not verdicts.

The evidence bundle is versioned and readonly in application types. Phase 6 moved browser persistence to `trial-by-user:runs:v3`; older records remain readable and receive a null evidence bundle during parsing. Refresh reuses the stored bundle. The interface issues no duplicate collection request while one is active, and only the explicit **Rebuild evidence** action replaces an existing bundle. Reset clears both the journey and bundle, and collected runs cannot take another simulation step until reset.

No LLM, embedding, provider credential, database, or background worker is involved in evidence preparation. The prosecutor and defense receive the same bundle rather than independently gathering evidence.

> Deterministic evidence preparation is more limited than an LLM evaluator, but it guarantees reproducibility, source traceability, and equal evidence access for both courtroom sides. Interpretive judgment is deferred to the prosecutor, defense, and judge.

### Phase 7 courtroom advocate boundary

`POST /api/courtroom/argue` performs exactly one advocate request for `prosecutor` or `defense`. The browser sends a run ID, role, and the prepared evidence bundle. Strict Zod validation runs before provider configuration. The server checks the bundle's run ID and version, resolves every page, section, summary, callout, and excerpt against trusted FlowPilot data, and recomputes the deterministic fact checks. A malformed or tampered request therefore fails before credentials are read or a provider call is attempted.

Both roles use one shared evidence formatter and receive byte-for-byte identical compact input: task, persona, customer outcome, coverage, bounded fact checks, and ordered evidence items with explicit customer-seen labels. The data is enclosed in an untrusted-evidence delimiter. Shared instructions prohibit retrieval, browsing, invented sources, hidden specifications, final adjudication, and private chain-of-thought. The only prompt variation is the prosecutor or defense role assignment, and neither request contains the other side's argument.

The existing provider abstraction now exposes reusable strict structured generation. Both advocate roles use the one server-configured Groq or OpenAI provider and model. Groq receives explicit strict JSON Schema; OpenAI receives the matching Zod format. Each role request makes at most one provider call. SDK retries remain disabled, and there is no fallback, repair request, or automatic regeneration.

Returned arguments must contain the assigned role, a bounded thesis, one to five key claims, a strongest point, up to three acknowledgements, one of the five requested verdict directions, and a closing statement. Every substantive point requires unique citations. A second validation pass rejects wrong roles and any evidence ID not present in the supplied bundle. The requested direction is an advocate's position, not a verdict.

Browser persistence is now `trial-by-user:runs:v4`; v3 and earlier runs migrate with an empty courtroom state. Each successful result records the argument, role, generation time, provider label, and evidence bundle ID/version. Regenerating one role preserves the other and replaces the existing record only after success. Rebuilding evidence or resetting the simulation clears both arguments. A client in-flight guard serializes provider calls. There is no judge endpoint, score, final verdict, recommendation, or additional retrieval.

> Persisting the MVP run in localStorage keeps deployment free and serverless, but the client must send a compact action history with each stateless step. Server persistence would improve integrity and cross-device access, but adds infrastructure and is deferred until it is needed.

Splitting autonomous execution into short requests makes timeouts, retries, budget enforcement, and UI observation compatible with Vercel Hobby. It also avoids a background worker or permanently running server. The tradeoff is that client-held history is not authoritative; every request therefore receives strict validation and only bounded, deterministic capabilities.

The app runs directly with Node.js 22 and npm. Docker Compose provides a local development convenience only: it runs the Next.js development server, mounts the source directory for hot reloading, and preserves container dependencies in a named volume. Production deployment targets Vercel Hobby through the normal Next.js build flow.

There is currently:

- no database;
- no authentication;
- no file storage or uploads;
- configurable Groq and OpenAI Responses API integrations for the synthetic customer and courtroom advocates;
- three stateless Route Handlers for simulation steps, evidence collection, and one courtroom argument, with no separate backend.

There is no database or server-side run persistence. Runs, evidence, and courtroom argument records use browser-specific localStorage. The prosecutor and defense exist; the judge does not.

There are also no arbitrary document or screenshot uploads. The controlled product is repository-owned content, not user-supplied content.

## Planned architecture

Trial by User will remain a single Next.js application. User-facing routes will use App Router pages and layouts. Server functionality will be implemented with Next.js Route Handlers and server-only modules, keeping the deployment compatible with Vercel's serverless model.

The remaining planned system boundaries are:

- **Frontend:** Next.js pages and components for setup, simulation playback, evidence review, arguments, and verdicts.
- **Server functions:** Next.js Route Handlers for validated requests, orchestration steps, and server-side provider access.
- **Persistence:** A hosted PostgreSQL service may be added later for products, test runs, evidence, and verdicts. No provider has been selected.
- **Product knowledge:** The local FlowPilot fixture remains the deterministic baseline. Bounded documents and screenshots may be added later through validated upload and processing flows; arbitrary uploads are not part of the current architecture.
- **Simulation orchestration:** The implemented short-request pattern will remain the boundary as the judge and later phases are added.
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
