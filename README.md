# Trial by User

Trial by User evaluates how well people can understand a product. A synthetic customer uses bounded actions to investigate a real product-understanding task; prosecutor and defense agents then assess the resulting evidence, and a judge returns a cited verdict and product recommendation.

## How It Works

1. Configure a test by selecting a customer task, persona, and action budget.
2. A synthetic customer searches and inspects the controlled product knowledge base.
3. The completed journey is converted into a deterministic, source-traceable evidence bundle.
4. Prosecutor and defense agents argue opposite sides using the exact same evidence.
5. A judge evaluates both arguments and returns a cited verdict and recommendation.

The included product, FlowPilot, is a fictional SaaS application with a fixed knowledge base designed for safe, repeatable testing.

## Architecture

<img width="1280" height="664" alt="Screenshot 2026-08-11 at 6 08 17 PM" src="https://github.com/user-attachments/assets/6be18a88-70d6-47e3-a682-4b4b64e0c364" />

LLMs choose customer actions and perform the courtroom reasoning. Retrieval, product-tool execution, and evidence preparation remain deterministic so runs are inspectable and evidence is reproducible.

## What Makes It Agentic

This is not a single `question → retrieve → answer` pipeline. The synthetic customer repeatedly chooses one bounded action:

```text
SEARCH
OPEN_PAGE
INSPECT_SECTION
ANSWER
GIVE_UP
```

Each successful action becomes part of the recorded journey. The customer receives only the product information it has actually discovered, rather than the complete knowledge base or a hidden expected answer.

The result is an agentic RAG-style loop: `retrieve → inspect → decide next action → eventually answer`. Retrieval currently uses deterministic lexical, section-level ranking rather than embeddings or a vector database. Deterministic evidence preparation may add a bounded amount of clearly labelled context, but the courtroom agents cannot independently retrieve new evidence.

## Tech Stack

- Next.js 16 and React 19
- TypeScript in strict mode
- Tailwind CSS
- Groq or OpenAI structured generation
- Zod validation
- Vitest
- Browser localStorage
- Docker Compose for local development
- Vercel-compatible serverless deployment

## Key Design Decisions

- **Deterministic retrieval before embeddings.** Lexical ranking is cheap, inspectable, reproducible, and straightforward to evaluate. Semantic retrieval can be introduced later when its benefit can be measured against this baseline.
- **Shared immutable evidence.** Prosecutor and defense receive exactly the same evidence bundle, so their disagreement reflects reasoning rather than different retrieval results.
- **Deterministic evidence preparation.** Evidence collection reconstructs trusted FlowPilot sources without an LLM, improving reproducibility, citation integrity, and source traceability.
- **One action per request.** Each customer step performs at most one provider request and one bounded action, keeping execution observable and compatible with Vercel serverless functions.
- **Actions and provider attempts are separate.** Failed provider requests stop safely and remain visible without consuming the customer's successful-action budget.

## Run Locally

Requires Node.js 22 and npm.

### Standard development

```bash
npm install
cp .env.example .env.local
npm run dev
```

For Groq-powered customer and courtroom actions, set these server-side values in `.env.local`:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_key
GROQ_MODEL=openai/gpt-oss-20b
```

Open [http://localhost:3000](http://localhost:3000). The interface, tests, and production build work without provider credentials; credentials are required only when a customer, advocate, or judge action is requested. OpenAI can be selected instead using the variables documented in [.env.example](.env.example).

### Docker

After creating `.env.local`, run:

```bash
docker compose up --build
```

### Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Limitations

- The current demo evaluates only the controlled fictional FlowPilot knowledge base.
- It does not crawl arbitrary live websites, click external interfaces, or perform real product actions.
- Runs, evidence, arguments, and verdicts are stored in browser localStorage rather than a database.
- Application rate limiting is best-effort and instance-local on serverless infrastructure.
- Lexical retrieval is intentionally simpler than embedding-based semantic retrieval.

Detailed design and implementation notes remain in [the product specification](docs/PRODUCT_SPEC.md), [architecture documentation](docs/ARCHITECTURE.md), and [implementation plan](docs/IMPLEMENTATION_PLAN.md).

Evaluation setup, metrics, and live-run safeguards are documented in [the evaluation guide](docs/EVALUATION.md).
