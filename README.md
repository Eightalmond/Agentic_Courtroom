# Trial by User

Trial by User is an agentic product-testing application. The planned product will let a synthetic customer attempt a focused task, preserve the journey as evidence, and ask prosecutor, defense, and judge agents to assess whether the experience worked.

The application foundation, controlled FlowPilot product, and Phase 3 test-creation flow are complete. Users can configure a predefined customer task and persona, choose an action limit, and create a ready run stored in their current browser. It does not yet execute simulations or include AI, retrieval, uploads, authentication, a database, or server persistence.

## Available routes

- `/` — Trial by User dashboard and current MVP status
- `/product` — FlowPilot knowledge-base index
- `/product/[slug]` — Individual FlowPilot knowledge pages
- `/tests/new` — Local test configuration flow
- `/runs/[id]` — Browser-local run detail

FlowPilot content is local, fictional, and deterministic. This gives future synthetic-customer work stable facts and controlled information-design friction without relying on a real company, an external website, or a content service.

The test library contains six predefined FlowPilot questions and five behavioral personas. Ready runs use a versioned localStorage record and remain tied to the browser that created them.

## Requirements

- Node.js 22
- npm
- Docker Desktop or another Docker Compose-compatible runtime (optional)

## Run locally with npm

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Run locally with Docker Compose

```bash
docker compose up --build
```

The project directory is mounted into the container for hot reloading. A named volume keeps container dependencies separate from any host `node_modules` directory. Open [http://localhost:3000](http://localhost:3000) after the server starts.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy to Vercel Hobby

1. Import this repository into Vercel.
2. Keep the detected framework preset as **Next.js**.
3. Use the default build command (`npm run build`) and output settings.
4. No environment variables are currently required.
5. Deploy on the Hobby plan.

The application uses the standard Next.js runtime and does not depend on Docker in production.

## Current limitations

- Test configuration creates a ready local run, but **Start simulation** remains intentionally disabled.
- There is no AI, synthetic-customer execution, or agent behavior.
- Arbitrary product documents and screenshots cannot be uploaded.
- No database, authentication, or backend integrations exist.
- Local runs are not shared between browsers or devices and are lost if their browser storage is cleared.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Coding agent instructions](AGENTS.md)
