# Trial by User

Trial by User is an agentic product-testing application. The planned product will let a synthetic customer attempt a focused task, preserve the journey as evidence, and ask prosecutor, defense, and judge agents to assess whether the experience worked.

This repository currently contains the application foundation only. It includes a responsive placeholder dashboard, a standard Next.js toolchain, local Docker support, and automated quality checks. It does not yet include simulations, AI, retrieval, uploads, authentication, or persistence.

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

- The dashboard is informational; **Create test** is intentionally disabled.
- There is no AI or agent behavior.
- Product documents and screenshots cannot be uploaded.
- No database, authentication, or backend integrations exist.
- No real or fictional product simulation is implemented yet.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Coding agent instructions](AGENTS.md)
