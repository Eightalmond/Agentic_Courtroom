# Architecture

## Current architecture

The current repository is a single Next.js application using the App Router, React, TypeScript in strict mode, and Tailwind CSS. The homepage and controlled FlowPilot product routes remain statically renderable. Test creation, run detail, retrieval, simulation, evidence, independent courtroom arguments, judge verdict, and final report provide bounded interaction. Short Next.js Route Handlers provide the server-only synthetic-customer, evidence-collection, advocate, and judge boundaries. Phase 9 adds visible public-demo constraints, server-only configuration, bounded request parsing, best-effort per-instance limits, duplicate-request guards, and security headers without adding persistent infrastructure. Project configuration, product-content integrity, run rules, retrieval, simulation, evidence, courtroom schemas, citations, persistence, provider errors, and demo safeguards are covered by Vitest.

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

`POST /api/simulations/step` performs exactly one bounded agent step. The browser sends a compact snapshot containing stable task and persona IDs, separate successful-action and provider-attempt counters, current content identifiers, limited recent search results, and sanitized action-history summaries. The server validates size, shape, sequential numbering, same-origin behavior, completion state, and the successful customer-action budget before any provider access. Trusted task and persona definitions are reconstructed from repository-owned IDs, so client-supplied descriptions cannot replace them.

The server builds a compact prompt with an explicit `<untrusted_product_data>` boundary, then resolves a server-configured Groq or OpenAI provider behind one customer-decision interface. A root-object Zod schema constrains the wire response, and a second discriminated-union schema enforces the exact fields for `SEARCH`, `OPEN_PAGE`, `INSPECT_SECTION`, `ANSWER`, and `GIVE_UP`. The public explanation is length-limited plain text; raw chain-of-thought and provider traces are neither requested nor returned.

After validation, a deterministic server-owned executor resolves search, page, and section actions only against the local FlowPilot data. Unknown identifiers become safe retryable failures, do not enter the successful action timeline, and do not trigger a second repair call. Answer and give-up actions complete the run without evaluating correctness. If the successful-action budget ends first, the run completes with a budget-exhausted outcome and no fabricated answer.

`LLM_PROVIDER` selects `groq` or `openai` and defaults to Groq for local development. Production deployments should set it explicitly. Only the selected provider's key and model are validated, and configuration is resolved only when a valid simulation step reaches the provider boundary—not during builds, static rendering, or deterministic request rejection. There is no automatic fallback.

Groq uses the existing official `openai` npm package with the fixed `https://api.groq.com/openai/v1` base URL and `responses.create`. The request supplies an explicit strict JSON Schema supported by the recommended `openai/gpt-oss-20b` model. The returned `output_text` must be exact JSON and must pass the existing Zod wire schema and exact action schema; there is no Markdown extraction, heuristic repair, or second provider call. OpenAI retains the Responses API parse path with the same Zod schemas.

Provider keys and model names are read only inside the request path from `GROQ_API_KEY`/`GROQ_MODEL` or `OPENAI_API_KEY`/`OPENAI_MODEL`. They are never sent to client code, responses, logs, or localStorage. SDK retries are disabled and requests have a short timeout. Provider authentication, rate-limit, timeout, connection, malformed-output, and invalid-tool failures map to stable safe errors. A provider call increments the separate attempt counter, but only a successfully executed customer action increments `currentActionCount` or reduces the configured action budget. Manual retry therefore targets the same next action number. A sanitized provider `Retry-After` duration is retained when trustworthy.

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

The existing provider abstraction exposes reusable strict structured generation. Both advocate roles use the one server-configured Groq or OpenAI provider and model. OpenAI retains Responses parsing with its Zod format. Groq courtroom arguments use the OpenAI-compatible `chat.completions.create` JSON Schema mode; the synthetic customer continues to use the already-working Groq `responses.create` path. This split is isolated inside the provider adapter. Each role request makes at most one provider call, SDK retries remain disabled, and there is no endpoint fallback, repair request, or automatic regeneration.

The Groq provider wire schema uses only closed objects, arrays, strings, and enums. It omits provider-authored claim IDs and flattens the strongest-point representation. A strict Zod wire schema validates bounds, unknown fields, roles, and evidence-ID syntax before a deterministic transform assigns `claim-1`, `claim-2`, and so on and reconstructs the internal argument shape. Domain and citation validation then run unchanged. This separation prevents harmless model naming choices from violating internal identifier conventions without weakening evidence citations.

GPT-OSS reasoning defaults previously shared a 1,400-token completion cap with the visible JSON and intermittently produced Groq `json_validate_failed` errors. Courtroom Chat Completions now requests low reasoning effort and reserves 4,000 completion tokens for reasoning plus the bounded response. Raw reasoning is not requested, parsed, returned, logged, or persisted. Development-only diagnostics log only the schema operation, HTTP status, sanitized provider code/type, and a fixed safe description; browser errors remain sanitized.

Returned arguments must contain the assigned role, a bounded thesis, one to five key claims, a strongest point, up to three acknowledgements, one of the five requested verdict directions, and a closing statement. Every substantive point requires unique citations. A second validation pass rejects wrong roles and any evidence ID not present in the supplied bundle. The requested direction is an advocate's position, not a verdict.

Phase 7 introduced `trial-by-user:runs:v4`; those and earlier records remain readable after the Phase 8 migration. Each newly generated argument also records a deterministic evidence fingerprint. Regenerating one role preserves the other and replaces the existing record only after success. Rebuilding evidence or resetting the simulation clears both arguments. A client in-flight guard serializes provider calls.

### Phase 8 judge boundary

`POST /api/courtroom/judge` accepts the minimum browser-held state needed by the stateless server: run ID, maximum action count, the prepared evidence bundle, and both advocate records. Before provider configuration is accessed, strict schemas and trusted reconstruction verify the completed evidence bundle, action-budget consistency, prosecutor and defense roles, all advocate citations, matching bundle ID/version, and a deterministic bundle fingerprint captured when each argument was generated. Phase 7 records without fingerprints remain readable but are not judge-eligible until regenerated.

The server builds one compact deterministic case record containing task, persona, customer outcome and conclusion, actions used versus maximum, coverage, mechanical checks, bounded evidence, and both structured arguments. Evidence and arguments are delimited as untrusted data. Internal task evaluation specifications, hidden expected answers, raw provider errors, browser storage, prompts, and chain-of-thought never enter the package.

Fairness instructions make the judge a neutral evaluator rather than a third advocate. Direct product evidence takes priority over rhetoric; mechanical checks are supporting signals rather than binding verdicts; customer-seen evidence is distinguished from unseen context; decision-point availability, persona, and action budget are considered; unsupported claims are penalized; and `insufficient_evidence` remains a valid outcome. The judge cannot retrieve, browse, request tools, or cite advocate claim IDs.

The provider-facing judge wire schema uses closed objects and simple arrays, strings, booleans, and enums. It flattens nullable friction and recommendation fields, then transforms into the strict nested domain schema. The result selects exactly one defined verdict and includes bounded cited findings, two side assessments, a cited customer-outcome assessment, optional primary friction, a cited recommendation, and confidence. Domain validation and shared citation validation reject unknown fields, malformed output, duplicate IDs, or evidence IDs outside the immutable bundle before persistence.

Both providers reuse the existing structured-generation interface. Groq uses the proven OpenAI-compatible `chat.completions.create` strict JSON Schema path, low reasoning effort, and a 6,000-token completion ceiling for the larger judge result. OpenAI uses `responses.parse` with the same Zod wire schema. One judge action makes exactly one provider request. SDK retries remain disabled; there is no repair call, fallback, or automatic regeneration.

Browser persistence is now `trial-by-user:runs:v6`. The migration keeps completed records readable and repairs unprepared legacy runs that were incorrectly exhausted by failed attempts. A judge record stores only the validated verdict, timestamp, safe provider label, bundle ID/version/fingerprint, and both advocate fingerprints. Refresh preserves it. Judge regeneration replaces only the judge after success, so failure preserves the prior verdict. Successful advocate regeneration invalidates the judge; evidence rebuild and simulation reset clear all courtroom records. None of these operations changes the customer action count or evidence contents. The UI exposes the complete verdict and a final report only when a judge record exists.

> The judge sees both adversarial arguments but remains constrained to the original immutable evidence bundle. This allows the judge to compare reasoning quality without introducing new retrieval asymmetry, at the cost of not being able to investigate evidence gaps independently.

### Phase 9 public demo boundary

`DEMO_MODE` is read only in server modules and server-rendered pages. It accepts `true` or `false`, defaults safely to `true`, and exposes only a derived boolean to interactive components. The three application-limit settings are also server-only. Provider availability and environment contents are not exposed through a health endpoint or client bundle.

The simulation, advocate, and judge Route Handlers share request-boundary helpers. They enforce same-origin browser requests when an `Origin` header is present, require JSON, reject bodies over route-specific byte ceilings, and apply existing strict Zod domain validation before rate limiting or provider configuration. Simulation history is bounded by the ten-action product maximum. Evidence arrays, source text, excerpts, fact checks, identifiers, claims, findings, and citations retain explicit nested limits so a small outer body cannot expand into an unbounded provider prompt.

After deterministic validation, a fixed-window in-memory limiter uses independent `simulation` and `courtroom` buckets. The courtroom bucket combines advocate and judge calls. On Vercel, `x-vercel-forwarded-for` or Vercel's overwritten `x-forwarded-for` supplies the client address; the application coarsens the network and stores only a truncated SHA-256 digest. Outside Vercel it does not trust forwarded-IP headers and falls back to a hashed host/user-agent bucket. Stores are capped and expired windows are removed opportunistically.

A second in-memory set prevents overlapping provider work for the same client, run, and bucket within one warm instance. Client guards also prevent double starts and serialize auto-run. These controls reduce accidental duplication but cannot guarantee cross-tab exclusion when requests reach different serverless instances. Correctness never depends on limiter state: every stateless request still validates the complete bounded run or courtroom state.

Provider clients share a centralized 20-second timeout and zero SDK retries. There is no automatic repair or provider fallback. A failed request updates only safe error and provider-attempt state; it neither appends a customer action nor reduces the successful-action budget. Auto-run is a browser loop that confirms the possible remaining successful-action count, awaits one response at a time, and cancels future iterations on completion, failure, exhaustion, stop, reset, refresh, or component unmount.

Application-wide headers set `nosniff`, a strict cross-origin referrer policy, disabled camera/microphone/geolocation/browsing-topics permissions, and deny framing. A Content Security Policy is not included because an untested policy could break Next.js development or deployment behavior. No `vercel.json` is necessary.

> The MVP uses browser-local persistence and best-effort in-memory application rate limiting to remain infrastructure-free on Vercel Hobby. This minimizes deployment cost and complexity, but it does not provide globally consistent abuse protection across serverless instances. Strong distributed rate limiting should be added only if public traffic requires it.

> Persisting the MVP run in localStorage keeps deployment free and serverless, but the client must send a compact action history with each stateless step. Server persistence would improve integrity and cross-device access, but adds infrastructure and is deferred until it is needed.

Splitting autonomous execution into short requests makes timeouts, retries, budget enforcement, and UI observation compatible with Vercel Hobby. It also avoids a background worker or permanently running server. The tradeoff is that client-held history is not authoritative; every request therefore receives strict validation and only bounded, deterministic capabilities.

The app runs directly with Node.js 22 and npm. Docker Compose provides a local development convenience only: it runs the Next.js development server, mounts the source directory for hot reloading, and preserves container dependencies in a named volume. Production deployment targets Vercel Hobby through the normal Next.js build flow.

There is currently:

- no database;
- no authentication;
- no file storage or uploads;
- configurable Groq and OpenAI structured-output integrations for the synthetic customer, courtroom advocates, and judge;
- four stateless Route Handlers for simulation steps, evidence collection, one courtroom argument, and one judge verdict, with no separate backend. Only the three provider-backed routes are rate-limited.

There is no database or server-side run persistence. Runs, evidence, courtroom argument records, and judge verdicts use browser-specific localStorage. The core controlled-product courtroom loop is complete.

There are also no arbitrary document or screenshot uploads. The controlled product is repository-owned content, not user-supplied content.

## Planned architecture

Trial by User will remain a single Next.js application. User-facing routes will use App Router pages and layouts. Server functionality will be implemented with Next.js Route Handlers and server-only modules, keeping the deployment compatible with Vercel's serverless model.

The remaining planned system boundaries are:

- **Frontend:** Next.js pages and components for setup, simulation playback, evidence review, arguments, and verdicts.
- **Server functions:** Next.js Route Handlers for validated requests, orchestration steps, and server-side provider access.
- **Persistence:** A hosted PostgreSQL service may be added later for products, test runs, evidence, and verdicts. No provider has been selected.
- **Product knowledge:** The local FlowPilot fixture remains the deterministic baseline. Bounded documents and screenshots may be added later through validated upload and processing flows; arbitrary uploads are not part of the current architecture.
- **Simulation orchestration:** The implemented short-request pattern remains the boundary for customer steps, advocates, judge, and later phases.
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
