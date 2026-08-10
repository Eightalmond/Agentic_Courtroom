# Trial by User

Trial by User is an agentic product-testing application. Its synthetic customer attempts one focused FlowPilot task through short, observable actions, then independent prosecutor and defense agents argue from the same prepared evidence. The judge remains deliberately unimplemented.

Phase 7 is complete. The application includes the controlled fictional FlowPilot knowledge base, local test creation, deterministic retrieval, a browser-local simulation timeline, deterministic evidence preparation, and separately generated source-cited courtroom arguments. The configured Groq or OpenAI provider handles customer decisions and advocates; evidence collection remains deterministic.

## Available routes

- `/` — dashboard and current MVP status
- `/product` and `/product/[slug]` — controlled FlowPilot knowledge
- `/tests/new` — test and persona configuration
- `/runs/[id]` — customer journey, evidence workspace, and independent courtroom advocates
- `/retrieval` — deterministic retrieval playground
- `/api/simulations/step` — server-only, one-action simulation boundary
- `/api/evidence/collect` — server-only, deterministic evidence collection boundary
- `/api/courtroom/argue` — server-only, one independent advocate call

## Requirements

- Node.js 22
- npm
- A Groq or OpenAI API key and a compatible model with Structured Outputs support for simulations and courtroom arguments
- Docker Desktop or another Docker Compose-compatible runtime (optional)

The app, tests, and production build do not require API credentials. Credentials are needed only when a simulation step or courtroom advocate is requested.

## Run locally with npm

```bash
npm install
cp .env.example .env.local
```

Add server-side values to `.env.local`:

```dotenv
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
4. Add only the selected provider's key and model variables as server-side project environment variables.
5. Do not expose provider variables with a `NEXT_PUBLIC_` prefix.
6. Deploy on the Hobby plan.

The production design uses short Route Handler requests and requires no permanently running backend or Docker runtime.

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

Each side makes one call through the same server-configured Groq or OpenAI provider and model used by the simulation. The response must match a strict bounded Zod schema. Every key claim, strongest point, and acknowledged opposing point requires valid, unique evidence IDs from the supplied bundle. Wrong-role output, fabricated citations, extra properties, or malformed output fail safely without fallback, retry, heuristic repair, or a second call.

Arguments are stored with the browser-local run, including role, provider label, timestamp, and bundle ID/version. Regenerating one side preserves the other and replaces the old argument only after success. Rebuilding evidence invalidates both arguments. The interface labels cited sources as customer-seen or not-seen and links to the controlled FlowPilot source. Requested verdict directions are advocacy, not a verdict; the judge control remains disabled.

## Current limitations

- Synthetic-customer simulation, evidence collection, and prosecutor/defense arguments exist; there is no judge or final verdict yet.
- Runs remain local to one browser and can be lost when browser data is cleared.
- FlowPilot is the only product, and retrieval is lexical over repository-owned content.
- There are no uploads, database, authentication, arbitrary URLs, live website controls, browser automation, or external product actions.
- A real simulation or advocate call requires valid credentials for the selected provider and a compatible configured model.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Coding agent instructions](AGENTS.md)
