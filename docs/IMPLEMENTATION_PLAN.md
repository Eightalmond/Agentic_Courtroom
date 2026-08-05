# Implementation plan

## Phase 1 — Application foundation (completed)

**Goal:** Establish a polished, documented Next.js application that is easy to run, verify, and deploy.

**Acceptance criteria:**

- Next.js App Router, strict TypeScript, Tailwind CSS, ESLint, npm, Node.js 22, and Vitest are configured.
- A responsive Trial by User placeholder dashboard communicates the planned workflow and MVP status.
- Local npm and Docker Compose development paths work with hot reloading.
- Linting, type checking, unit tests, and a production build pass.
- The architecture remains compatible with Vercel Hobby and the repository documentation guides future work.

## Phase 2 — Controlled fictional SaaS product (planned)

**Goal:** Create a safe, deterministic product experience that simulations can evaluate without accessing external websites.

**Acceptance criteria:**

- A fictional SaaS product and its bounded capabilities are documented.
- Realistic product knowledge and task fixtures are versioned in the repository.
- Users can browse the fictional product experience without external side effects.

## Phase 3 — Test creation flow (planned)

**Goal:** Let a user configure one focused customer test.

**Acceptance criteria:**

- A user can select product context, describe a customer, and define a narrow task.
- Required fields and length limits are validated on the server.
- The configuration can be reviewed before a run begins.

## Phase 4 — Deterministic retrieval (planned)

**Goal:** Supply relevant product knowledge through a predictable, testable retrieval layer.

**Acceptance criteria:**

- Retrieval operates only on approved product fixtures.
- Ranking and source references are deterministic for the same input.
- Unit tests cover relevance, empty results, and boundary cases.

## Phase 5 — Synthetic customer agent (planned)

**Goal:** Simulate a customer attempting the configured task through short, constrained steps.

**Acceptance criteria:**

- Each step receives bounded context and returns a validated structured result.
- Runs enforce step and resource limits compatible with serverless execution.
- The customer cannot control arbitrary live websites or perform external actions.

## Phase 6 — Evidence collection (planned)

**Goal:** Preserve an auditable record of the customer's actions, observations, and conclusions.

**Acceptance criteria:**

- Evidence entries include sequence, source references, and timestamps.
- Unsupported conclusions can be distinguished from sourced observations.
- Incomplete and failed runs retain useful diagnostic evidence.

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
