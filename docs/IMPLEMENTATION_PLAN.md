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
- Manual and auto-run controls prevent parallel calls, stop on completion, and enforce a maximum of 10 configured model calls.
- Tests cover schemas, boundaries, tools, prompts, provider errors, budget exhaustion, migration, reset, and no-call validation failures without consuming API credits.
- The customer cannot control arbitrary live websites, access arbitrary URLs or files, or perform external actions.

## Phase 5.1 — Configurable LLM provider (completed)

**Goal:** Add Groq as the recommended local simulation provider without changing the customer state machine or deterministic tools.

**Acceptance criteria:**

- Server-side `LLM_PROVIDER` selection supports `groq` and `openai`, defaults to Groq locally, and validates only the selected provider at request execution.
- Groq uses the existing official OpenAI-compatible client with a fixed endpoint, strict JSON Schema, Zod validation, disabled SDK retries, and at most one request per step.
- Provider failures map to safe stable errors, consume the attempted model-call budget, and never trigger automatic fallback or repair calls.
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
- The evidence workspace provides coverage, filters, source links, fact checks, and a disabled Phase 7 courtroom control.
- The collector uses no provider credentials, database, embeddings, uploads, URLs, browser automation, or courtroom agents.

## Phase 7 — Prosecutor and defense agents (planned)

**Goal:** Produce opposing assessments grounded only in the collected evidence.

**Acceptance criteria:**

- Each argument cites specific evidence records.
- The prosecutor and defense use clearly separated instructions and outputs.
- Missing or contradictory evidence is surfaced rather than invented.

## Phase 8 — Judge and verdict (planned)

**Goal:** Return a reasoned verdict and practical product recommendation.

**Acceptance criteria:**

- The judge selects exactly one defined verdict category.
- The rationale cites the evidence and addresses both arguments.
- Confidence and an actionable recommendation are included.
- Insufficient evidence is selected when the record cannot support a conclusion.

## Phase 9 — Run visualization (planned)

**Goal:** Make the complete simulation and courtroom process easy to inspect.

**Acceptance criteria:**

- Users can follow the run as an ordered timeline.
- Evidence, arguments, and verdict citations are visibly connected.
- Loading, failure, partial, and completed states are accessible and responsive.

## Phase 10 — Document and screenshot uploads (planned)

**Goal:** Add bounded, secure product-knowledge ingestion.

**Acceptance criteria:**

- Supported file types, sizes, and counts are validated before processing.
- Extracted content retains traceable source metadata.
- Upload storage, retention, and deletion behavior are documented.

## Phase 11 — Public demo protections (planned)

**Goal:** Make a public demonstration safe and cost-aware.

**Acceptance criteria:**

- Per-run limits, rate limits, and input limits are enforced server-side.
- Abuse and error behavior fail safely without exposing secrets.
- Usage can be observed well enough to protect free-tier limits.

## Phase 12 — Deployment hardening (planned)

**Goal:** Prepare the MVP for reliable Vercel Hobby deployment.

**Acceptance criteria:**

- Environment variables, serverless limits, and deployment steps are documented.
- Critical flows have automated coverage and actionable error reporting.
- Accessibility, performance, privacy, and security checks are completed.
- Production requires no permanently running backend process.
