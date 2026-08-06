# Trial by User

Trial by User is an agentic product-testing application. Its synthetic customer now attempts one focused FlowPilot task through short, observable actions. Courtroom evaluation—prosecutor, defense, and judge agents—remains deliberately unimplemented.

Phase 5 is complete. The application includes the controlled fictional FlowPilot knowledge base, local test creation, deterministic retrieval, and a browser-local simulation timeline backed by a stateless Next.js Route Handler and the OpenAI Responses API.

## Available routes

- `/` — dashboard and current MVP status
- `/product` and `/product/[slug]` — controlled FlowPilot knowledge
- `/tests/new` — test and persona configuration
- `/runs/[id]` — synthetic customer controls, journey, and outcome
- `/retrieval` — deterministic retrieval playground
- `/api/simulations/step` — server-only, one-action simulation boundary

## Requirements

- Node.js 22
- npm
- An OpenAI API key and a Responses API model with Structured Outputs support for simulations
- Docker Desktop or another Docker Compose-compatible runtime (optional)

The app, tests, and production build do not require API credentials. Credentials are needed only when a simulation step is requested.

## Run locally with npm

```bash
npm install
cp .env.example .env.local
```

Add server-side values to `.env.local`:

```dotenv
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

Tests mock the customer-decision provider and never make real OpenAI requests.

## Deploy to Vercel Hobby

1. Import the repository into Vercel and keep the detected Next.js preset.
2. Keep the default `npm run build` command and Node.js 22 runtime.
3. Add `OPENAI_API_KEY` and `OPENAI_MODEL` as server-side project environment variables.
4. Do not expose either variable with a `NEXT_PUBLIC_` prefix.
5. Deploy on the Hobby plan.

The production design uses short Route Handler requests and requires no permanently running backend or Docker runtime.

## How simulation works

The browser stores the run and sends a compact, validated history to `POST /api/simulations/step`. The server reconstructs the trusted task and persona, asks the OpenAI Responses API for one strict structured decision, validates it, and executes one deterministic tool against local FlowPilot content. The response returns the action and updated simulation fields for browser-local persistence.

Calls are sequential, retries are minimized, deterministic validation happens before provider access, and the server enforces a maximum of 10 configured model calls. Product content is explicitly delimited as untrusted data. Internal expected-page metadata and expected answers are never added to the customer prompt.

## Current limitations

- Only the synthetic customer exists; there is no evidence collector or courtroom evaluation.
- Runs remain local to one browser and can be lost when browser data is cleared.
- FlowPilot is the only product, and retrieval is lexical over repository-owned content.
- There are no uploads, database, authentication, arbitrary URLs, live website controls, browser automation, or external product actions.
- A real OpenAI API call requires valid credentials and a compatible configured model.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Coding agent instructions](AGENTS.md)
