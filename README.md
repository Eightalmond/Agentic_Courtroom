# Trial by User

Trial by User is an agentic product-testing application. Its synthetic customer attempts one focused FlowPilot task through short, observable actions, independent prosecutor and defense agents argue from the same prepared evidence, and a neutral judge returns a cited verdict and recommendation.

Phase 9 is complete. The core courtroom MVP now includes public-demo safeguards for a low-cost Vercel Hobby deployment: visible demo boundaries, recommended scenarios, explicit LLM-usage notices, sequential auto-run confirmation, bounded requests, best-effort per-instance rate limits, same-instance duplicate-request protection, friendly errors, and application security headers. The configured Groq or OpenAI provider handles customer decisions, advocates, and judge; retrieval and evidence collection remain deterministic.

## Available routes

- `/` — dashboard and current MVP status
- `/product` and `/product/[slug]` — controlled FlowPilot knowledge
- `/tests/new` — test and persona configuration
- `/runs/[id]` — customer journey, evidence workspace, courtroom advocates, judge verdict, and final report
- `/retrieval` — deterministic retrieval playground
- `/api/simulations/step` — server-only, one-action simulation boundary
- `/api/evidence/collect` — server-only, deterministic evidence collection boundary
- `/api/courtroom/argue` — server-only, one independent advocate call
- `/api/courtroom/judge` — server-only, one neutral judge call

## Requirements

- Node.js 22
- npm
- A Groq or OpenAI API key and a compatible model with Structured Outputs support for simulations and courtroom generation
- Docker Desktop or another Docker Compose-compatible runtime (optional)

The app, tests, and production build do not require API credentials. Credentials are needed only when a simulation step, courtroom advocate, or judge is requested.

## Run locally with npm

```bash
npm install
cp .env.example .env.local
```

Add server-side values to `.env.local`:

```dotenv
DEMO_MODE=true
SIMULATION_RATE_LIMIT=30
COURTROOM_RATE_LIMIT=10
RATE_LIMIT_WINDOW_SECONDS=600

LLM_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
```

Groq is the recommended local provider and is the default when `LLM_PROVIDER` is omitted. To use OpenAI instead, configure:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If the variables are absent, the rest of the app remains usable and starting a simulation shows a safe setup error.

## Run locally with Docker Compose

Create `.env.local` as above, then run:

```bash
docker compose up --build
```

The project directory is mounted for hot reloading, so Next.js reads the same `.env.local` inside the development container. `.dockerignore` prevents local secrets from being copied into the image, and a named volume keeps container dependencies separate from host `node_modules`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tests mock all provider calls and never consume provider credits.

## Deploy to Vercel Hobby

1. Import the repository into Vercel and keep the detected Next.js preset.
2. Keep the default `npm run build` command and Node.js 22 runtime.
3. Set `LLM_PROVIDER` explicitly to `groq` or `openai` for production.
4. Keep `DEMO_MODE=true` for a public portfolio deployment and set the three server-side application-limit variables.
5. Add only the selected provider's key and model variables as server-side project environment variables.
6. Do not expose any of these variables with a `NEXT_PUBLIC_` prefix.
7. Deploy on the Hobby plan.

The production design uses short Node-compatible Route Handler requests and requires no permanently running backend, writable filesystem, localhost service, database, or Docker runtime. Runs remain in browser localStorage. No `vercel.json` is needed.

## Public demo safeguards

`DEMO_MODE` accepts `true` or `false` and safely defaults to `true` when missing or invalid. Demo mode visibly identifies FlowPilot as fictional, keeps the existing predefined tasks and personas, and does not activate unfinished capabilities. Creating or preselecting a test never invokes a provider.

The three provider-backed routes use fixed-window, dependency-free in-memory limits. Defaults are 30 customer steps and 10 combined advocate/judge generations per client per 10 minutes. On Vercel, the limiter uses Vercel's platform-supplied forwarded address, coarsens it, and stores only a short hash. Without a trusted platform address it falls back to a hashed host/user-agent bucket; raw IP addresses are never persisted.

Rate limiting and the per-run in-flight guard are best-effort protections within one warm server instance. They do not coordinate across Vercel instances, regions, browser tabs routed to different instances, or cold starts. They are cost guardrails, not strong distributed abuse prevention. Every endpoint still validates origin, content type, byte size, schema bounds, trusted source references, completion state, and courtroom freshness before invoking the configured provider.

Provider actions are explicit. One customer step, one advocate, or one judge action makes at most one provider request. Auto-run asks for confirmation, reports the maximum remaining calls, awaits each step sequentially, and stops on completion, failure, budget exhaustion, user stop, reset, refresh, or unmount. SDK retries and provider fallback remain disabled.

All application responses include `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and `X-Frame-Options: DENY`. A CSP is intentionally deferred until it can be tested against the deployed Next.js application.

> The MVP uses browser-local persistence and best-effort in-memory application rate limiting to remain infrastructure-free on Vercel Hobby. This minimizes deployment cost and complexity, but it does not provide globally consistent abuse protection across serverless instances. Strong distributed rate limiting should be added only if public traffic requires it.

## How simulation works

The browser stores the run and sends a compact, validated history to `POST /api/simulations/step`. The server reconstructs the trusted task and persona, resolves the configured provider, asks its Responses API for one strict structured decision, validates it with Zod, and executes one deterministic tool against local FlowPilot content. The response returns the action and updated simulation fields for browser-local persistence.

Groq uses the official `openai` npm client against the fixed `https://api.groq.com/openai/v1` compatibility endpoint. It calls `responses.create` with an explicit strict JSON Schema, parses `response.output_text` as exact JSON, and then applies the same wire and discriminated-union Zod validation used by OpenAI. SDK retries are disabled, and the application never falls back automatically to a different provider.

Calls are sequential, retries are minimized, deterministic validation happens before provider access, and the server enforces a maximum of 10 configured model calls. Product content is explicitly delimited as untrusted data. Internal expected-page metadata and expected answers are never added to the customer prompt.

## How evidence collection works

After an answer, give-up, or action-budget outcome, the run page offers **Prepare evidence**. `POST /api/evidence/collect` validates the completed journey, reconstructs trusted task, persona, and FlowPilot sources, then returns one versioned evidence bundle. Search results, opened pages, inspected sections, and displayed callouts become customer-seen journey evidence. Required unseen sections become missing evidence, while at most three separate unseen sections may be included as clearly labelled context.

Six internal task evaluation specifications contain source IDs and bounded fact concepts—not full expected natural-language answers. Mechanical fact checks use explainable phrase and negation rules to label answer concepts as supported, unsupported, contradicted, or not assessable. These checks prepare evidence and are not a verdict.

The bundle records source text, stable references, exposure actions, coverage, integrity counts, customer outcome, and mechanical checks. It is saved with the run in versioned localStorage, survives refresh, and is removed by simulation reset. An existing bundle is reused by the interface; **Rebuild evidence** is the explicit replacement action for an unchanged completed run. Both courtroom sides receive this exact bundle.

> Deterministic evidence preparation is more limited than an LLM evaluator, but it guarantees reproducibility, source traceability, and equal evidence access for both courtroom sides. Interpretive judgment is separated across the prosecutor, defense, and future judge.

## How courtroom arguments work

After evidence is prepared, either advocate can run first. `POST /api/courtroom/argue` validates the run, bundle version, trusted FlowPilot source references, and deterministic fact checks before provider configuration is read. The prosecutor and defense receive the exact same compact evidence input and shared rules; only the role assignment changes. Neither request includes the other side's argument.

Each side makes one call through the same server-configured Groq or OpenAI provider and model used by the simulation. OpenAI continues to use Responses parsing. Groq courtroom arguments use OpenAI-compatible Chat Completions JSON Schema mode because its Responses path proved unreliable for this larger structured result; the working synthetic-customer Responses path is unchanged. The Groq courtroom request uses low reasoning effort, does not request raw reasoning, and reserves completion space for both reasoning and the bounded JSON.

The provider-facing courtroom wire shape omits free-form claim IDs and flattens the strongest-point fields. After strict wire validation, the server assigns deterministic claim IDs and transforms the result into the existing internal argument shape. Every key claim, strongest point, and acknowledged opposing point still requires valid, unique evidence IDs from the supplied bundle. Wrong-role output, fabricated citations, extra properties, or malformed output fail safely without fallback, retry, heuristic repair, or a second call.

Arguments are stored with the browser-local run, including role, provider label, timestamp, bundle ID/version, and a deterministic evidence fingerprint. Regenerating one side preserves the other, replaces the old argument only after success, and invalidates an existing judge verdict. Rebuilding evidence invalidates both arguments and the judge. The interface labels cited sources as customer-seen or not-seen and links to the controlled FlowPilot source. Requested verdict directions remain advocacy rather than adjudication.

## How the judge works

After both current arguments exist, `POST /api/courtroom/judge` revalidates the immutable evidence bundle, both argument roles, every advocate citation, bundle ID/version consistency, and deterministic evidence fingerprints before provider configuration is read. Legacy Phase 7 arguments remain readable but must be regenerated because they predate freshness fingerprints.

The judge receives the task, persona, customer outcome, conclusion, action budget, bundle summary, non-binding mechanical checks, all bounded evidence items, and both structured arguments. It is instructed to evaluate both sides fairly, prefer direct product evidence over rhetoric, distinguish customer-seen sources from unseen context, penalize unsupported claims, and choose `insufficient_evidence` when the record cannot support a fair conclusion. It cannot retrieve, browse, request tools, or cite advocate claim IDs.

One strict structured provider call returns exactly one of `pass`, `pass_with_friction`, `misleading`, `blocked`, or `insufficient_evidence`, plus bounded cited findings, both-side assessments, a customer-outcome assessment, optional primary friction, one concrete cited recommendation, and confidence. Groq reuses Chat Completions strict JSON Schema with low reasoning effort and a larger judge completion budget; OpenAI reuses Responses parsing. There is no retry, repair call, provider fallback, or second request.

Every judge citation must be unique within its field and resolve to the current product evidence bundle before persistence. The browser stores only the validated verdict record and fingerprints—not prompts, raw model output, provider errors, or hidden reasoning. Failed regeneration preserves the prior verdict. The run page shows the verdict, findings, side assessments, primary friction, recommendation, linked source chips, and a compact final report.

> The judge sees both adversarial arguments but remains constrained to the original immutable evidence bundle. This allows the judge to compare reasoning quality without introducing new retrieval asymmetry, at the cost of not being able to investigate evidence gaps independently.

## Current limitations

- The controlled FlowPilot courtroom loop is complete; uploads and arbitrary live-product testing are not available.
- Runs remain local to one browser and can be lost when browser data is cleared.
- In-memory demo rate limits reset on cold starts and are not shared globally across serverless instances.
- Browser-local state and stateless functions cannot perfectly prevent simultaneous cross-tab requests routed to different instances.
- FlowPilot is the only product, and retrieval is lexical over repository-owned content.
- There are no uploads, database, authentication, arbitrary URLs, live website controls, browser automation, or external product actions.
- A real simulation, advocate, or judge call requires valid credentials for the selected provider and a compatible configured model.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Coding agent instructions](AGENTS.md)
