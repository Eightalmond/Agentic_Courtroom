# Implementation plan

## Phase 1 — Application foundation (completed)

**Goal:** Establish a polished, documented Next.js application that is easy to run, verify, and deploy.

**Acceptance criteria:**

- Next.js App Router, strict TypeScript, Tailwind CSS, ESLint, npm, Node.js 22, and Vitest are configured.
- A responsive Trial by User placeholder dashboard communicates the planned workflow and MVP status.
- Local npm and Docker Compose development paths work with hot reloading.
- Linting, type checking, unit tests, and a production build pass.
- The architecture remains compatible with Vercel Hobby and the repository documentation guides future work.

## Phase 2 — Controlled fictional SaaS product (completed)

**Goal:** Create a safe, deterministic product experience that simulations can evaluate without accessing external websites.

**Acceptance criteria:**

- FlowPilot and its bounded capabilities are documented across ten local knowledge pages.
- Realistic, internally consistent product knowledge is typed and versioned in the repository.
- Users can browse `/product` and `/product/[slug]` without external side effects.
- Automated tests validate unique slugs, related links, page structure, required product facts, and slug lookup behavior.
- The dashboard distinguishes the available controlled product from future test and courtroom features.

## Phase 3 — Test creation flow (completed)

**Goal:** Let a user configure one focused customer test.

**Acceptance criteria:**

- A user can select one of six predefined tasks and one of five behavioral personas for FlowPilot.
- The user can choose a maximum action count from 3 to 10 and review a live configuration summary.
- Client-side business rules validate task, persona, and action-limit selections without an API or server action.
- Creating a test generates a URL-safe ID and persists a normalized `ready` run with zero actions in versioned localStorage.
- `/runs/[id]` safely handles loading, found, refreshed, and missing browser-local runs.
- Automated tests cover task and persona integrity, product-page references, run IDs, validation, and local persistence.
- No AI simulation, retrieval, evidence collection, or courtroom behavior executes.

## Phase 4 — Deterministic retrieval (completed)

**Goal:** Supply relevant product knowledge through a predictable, testable retrieval layer.

**Acceptance criteria:**

- A section-level index is derived entirely from the approved local FlowPilot fixture.
- Query normalization, stop-word removal, and bounded product synonyms are deterministic and dependency-free.
- Explainable fixed weights rank exact phrases, direct field matches, lower-weight synonyms, and multi-term coverage.
- Results include stable source IDs, bounded excerpts, match terms, locations, scores, and readable breakdowns.
- `/retrieval` supports examples, category filtering, result limits, empty guidance, and no-results handling.
- Configured run pages show three query-derived retrieval suggestions without changing status or action count.
- Automated tests cover index integrity, normalization, scoring, ordering, filters, excerpts, target queries, and metadata isolation.
- No embeddings, vector search, RAG pipeline, AI agent, API route, or database is present.

## Phase 5 — Synthetic customer agent (completed)

**Goal:** Simulate a customer attempting the configured task through short, constrained steps.

**Acceptance criteria:**

- Each HTTP request makes at most one selected-provider Responses API call and receives one strict structured customer action.
- The stateless Route Handler validates compact browser-supplied state, reconstructs trusted task and persona data, and executes only deterministic FlowPilot tools.
- Browser-local runs preserve sequential actions, current content, outcomes, safe errors, and Phase 3 migration compatibility.
- Manual and auto-run controls prevent parallel calls, stop on completion, and enforce a maximum of 10 successful customer actions without charging failures to that budget.
- Tests cover schemas, boundaries, tools, prompts, provider errors, budget exhaustion, migration, reset, and no-call validation failures without consuming API credits.
- The customer cannot control arbitrary live websites, access arbitrary URLs or files, or perform external actions.

## Phase 5.1 — Configurable LLM provider (completed)

**Goal:** Add Groq as the recommended local simulation provider without changing the customer state machine or deterministic tools.

**Acceptance criteria:**

- Server-side `LLM_PROVIDER` selection supports `groq` and `openai`, defaults to Groq locally, and validates only the selected provider at request execution.
- Groq uses the existing official OpenAI-compatible client with a fixed endpoint, strict JSON Schema, Zod validation, disabled SDK retries, and at most one request per step.
- Provider failures map to safe stable errors, increment only the separate provider-attempt counter when a call occurred, consume no customer action, and never trigger automatic fallback or repair calls.
- Existing simulation actions, API contracts, local persistence, and deterministic tool behavior remain unchanged.
- Documentation covers local Docker and npm configuration plus explicit production selection.

## Phase 6 — Evidence collection (completed)

**Goal:** Preserve an auditable record of the customer's actions, observations, and conclusions.

**Acceptance criteria:**

- Answer, give-up, and budget-exhausted journeys produce one deterministic, versioned evidence bundle without an LLM call.
- Customer-seen search results, opened pages, inspected sections, and callouts retain trusted source references and first-exposure actions.
- Required unseen sources are labelled missing; no more than three separate unseen sources are clearly labelled as context.
- Six internal task specifications provide valid section IDs, bounded fact concepts, qualification sources, and contradictory claim markers without storing full expected answers.
- Mechanical checks return supported, unsupported, contradicted, or not-assessable and are visibly separated from future verdicts.
- Integrity metadata records action, tool, completion, coverage, and missing-evidence counts.
- The browser-local bundle survives refresh, explicit rebuild replaces it, and simulation reset clears it while older runs remain readable.
- The evidence workspace provides coverage, filters, source links, and fact checks for the next phase.
- The collector uses no provider credentials, database, embeddings, uploads, URLs, browser automation, or courtroom agents.

## Phase 7 — Prosecutor and defense agents (completed)

**Goal:** Produce opposing assessments grounded only in the collected evidence.

**Acceptance criteria:**

- Either advocate can run first, with at most one provider call active at a time.
- Both sides receive the exact same compact immutable evidence bundle and shared prompt rules; only their role assignment differs.
- Each strict structured argument includes a thesis, bounded claims, strongest point, acknowledgements, requested direction, and closing statement.
- Every substantive point cites unique IDs from the supplied bundle; wrong roles and fabricated citations fail safely.
- The existing provider abstraction uses the single configured Groq or OpenAI provider/model with no fallback, automatic retry, or repair call; Groq isolates courtroom Chat Completions from the working customer Responses path.
- A Groq-compatible wire schema transforms into the unchanged internal argument while preserving strict bounds, unknown-field rejection, roles, and evidence citations.
- Browser-local records retain role, provider, timestamp, and evidence bundle ID/version; regeneration and invalidation behavior preserves citation integrity.
- The interface displays both independent cases, seen/not-seen source links, and a disabled Phase 8 judge control.
- Automated tests mock all providers and cover schemas, prompts, source validation, call counts, role isolation, persistence, migration, and safe failures.

## Phase 8 — Judge and verdict (completed)

**Goal:** Return a reasoned verdict and practical product recommendation.

**Acceptance criteria:**

- The judge runs only after a completed journey, current immutable evidence, and valid prosecutor and defense arguments reference the same bundle ID, version, and fingerprint.
- One strict structured request through the configured Groq or OpenAI provider selects exactly one defined verdict category with no retry, repair, fallback, retrieval, or tool request.
- Bounded findings, both-side assessments, customer-outcome assessment, optional primary friction, confidence, and one concrete recommendation are returned.
- Every substantive result cites unique evidence IDs from the original bundle, and fabricated or advocate claim IDs fail before persistence.
- Fairness rules prefer direct evidence over rhetoric, keep mechanical checks non-binding, distinguish customer-seen from unseen context, and preserve insufficient evidence as a responsible outcome.
- Browser-local persistence survives refresh; successful argument regeneration, evidence rebuild, and reset apply the documented invalidation rules while failed judge regeneration preserves the prior verdict.
- The run page displays a prominent verdict, linked citations, findings, side assessments, friction, recommendation, and a compact final report.
- Automated tests and production builds require no provider credentials.

## Phase 9 — MVP deployment hardening and demo safeguards (completed)

**Goal:** Prepare the completed courtroom MVP for a clear, cost-aware public portfolio deployment on Vercel Hobby.

**Acceptance criteria:**

- Public demo mode defaults safely, visibly explains the controlled FlowPilot boundary, and offers three valid recommended configurations without starting provider work.
- Provider-backed controls disclose request usage; auto-run confirms its possible remaining calls and remains strictly sequential and cancellable.
- Simulation and courtroom Route Handlers enforce same-origin JSON, byte ceilings, nested schema bounds, completed/stale-state rules, best-effort per-client limits, and same-instance duplicate-request guards before provider access.
- Groq and OpenAI share a centralized bounded timeout, SDK retries and provider fallback remain disabled, and failed regeneration preserves successful browser-local records.
- Security headers, friendly error messages, Vercel assumptions, environment variables, and the limits of browser-local persistence and in-memory rate limiting are documented.
- Automated checks, production build, Docker configuration/build, and responsive browser smoke testing pass without provider credentials.

## Phase 10 — Document and screenshot uploads (planned)

**Goal:** Add bounded, secure product-knowledge ingestion.

**Acceptance criteria:**

- Supported file types, sizes, and counts are validated before processing.
- Extracted content retains traceable source metadata.
- Upload storage, retention, and deletion behavior are documented.

## Phase 11 — Public traffic scaling (deferred)

**Goal:** Add globally consistent abuse protection only if real public traffic requires infrastructure beyond the Phase 9 portfolio safeguards.

**Acceptance criteria:**

- Traffic evidence demonstrates that best-effort per-instance limits are insufficient.
- Any distributed limiter has an explicit cost, retention, privacy, and failure-mode review.
- Stronger protection does not become authentication or broaden the product scope implicitly.

## Phase 12 — Production-scale deployment review (deferred)

**Goal:** Reassess infrastructure only if Trial by User moves beyond a portfolio-scale Vercel Hobby demo.

**Acceptance criteria:**

- Production traffic, persistence, collaboration, retention, and compliance requirements are explicitly defined.
- Any move beyond browser-local persistence is separately designed and approved.
- Accessibility, performance, privacy, security, and operational monitoring receive production-scale review.
- The application remains serverless unless a separately approved requirement proves otherwise.
