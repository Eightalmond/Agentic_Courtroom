# Trial by User product specification

## Product concept

Trial by User is an agentic product-testing application. A synthetic customer receives a narrow task and product-specific information, attempts to reach a conclusion, and leaves an auditable trail. A prosecutor argues that the experience failed, a defense argues that it succeeded, and a judge returns an evidence-grounded verdict and recommendation.

The courtroom framing creates a disciplined evaluation process: claims must point to observable evidence, opposing interpretations are considered, and the final result is more useful than a generic usability score.

## Target user

The initial user is a product manager, founder, designer, or researcher at an early-stage software company who needs fast, repeatable feedback on a specific product experience before investing in broader customer research. Trial by User supports focused investigation; it does not replace real customer research.

## Main user flow

1. Browse or select product knowledge, initially from the completed controlled FlowPilot knowledge base and later from bounded documents and screenshots.
2. Select a predefined customer task and behavioral persona, then configure a bounded action allowance (available now).
3. Inspect deterministic retrieval suggestions for the configured question (available now).
4. Start a simulation and watch the synthetic customer reason through the available information.
5. Review the chronological actions, conclusions, and supporting evidence.
6. Compare the prosecutor and defense arguments.
7. Read the judge's verdict, confidence, rationale, and recommended product action.

## Planned frontend screens

- Dashboard and recent test runs
- Controlled FlowPilot knowledge-base index and detail pages (available now)
- Product knowledge setup
- Test creation and task definition (available now)
- Browser-local configured run detail (available now)
- Deterministic retrieval playground and run suggestions (available now)
- Active run visualization
- Evidence timeline
- Courtroom arguments
- Verdict detail
- Product knowledge and asset management
- Public demo experience with usage protections

## Verdict categories

- **Pass** — The customer completes the task and the evidence shows the experience worked as intended.
- **Pass with friction** — The customer completes the task, but avoidable ambiguity, effort, or hesitation materially weakens the experience.
- **Misleading** — The experience leads the customer toward a materially incorrect belief or outcome.
- **Blocked** — The customer cannot complete the task because required information or a usable path is missing.
- **Insufficient evidence** — The available product information or recorded journey cannot support a responsible conclusion.

## MVP inclusions

- A controlled fictional SaaS product, FlowPilot, as the initial test surface
- Creation of one narrowly scoped customer task per run
- Deterministic retrieval from curated product knowledge
- A synthetic customer simulation divided into observable steps
- Evidence capture for customer actions and conclusions
- Prosecutor and defense arguments grounded in recorded evidence
- A judge verdict using the five defined categories
- A run timeline and verdict visualization
- Later MVP support for bounded product document and screenshot uploads
- Basic public demo rate and abuse protections
- Deployment compatible with Vercel Hobby

## MVP exclusions

- Controlling arbitrary live websites
- Clicking real external website buttons
- Browser automation
- Purchases or irreversible actions
- Multi-user collaboration
- Production-scale customer testing
- Authentication and account management unless separately approved for a later scope
- A general-purpose autonomous web agent
- Arbitrary or unbounded document and screenshot uploads

## Controlled product: FlowPilot

FlowPilot is a fictional workflow automation platform for small teams. Its local knowledge base currently contains ten browsable pages covering the product overview, pricing, free trials and billing, cancellation, refunds, API access and limits, team permissions, data export, and security and privacy.

The content is deliberately deterministic and internally consistent. Future simulations will be able to make repeatable decisions from the same evidence. Subtle friction comes from where information appears: for example, pricing mentions Pro API access without its numerical allowance, while the API rate-limit page states the allowance clearly. The knowledge base never connects to a real company or enables an external action.

Available controlled-product routes:

- `/product` lists all FlowPilot knowledge pages.
- `/product/[slug]` renders one structured knowledge page and links to related content.

Phase 2 provides product content and browsing. Arbitrary document uploads remain excluded.

## Local test creation

Phase 3 adds a deterministic test-creation flow at `/tests/new`. Users choose from six predefined FlowPilot questions, five behavioral customer personas, and an action allowance from 3 to 10. The task library retains stable IDs, categories, difficulty labels, scenarios, and relevant FlowPilot page references. The persona library retains stable IDs, behavior traits, and bounded default action allowances.

Creating a test produces a `ready` run with zero completed actions and opens `/runs/[id]`. The run page displays the selected task, persona, action allowance, and three deterministic retrieval suggestions. It never displays an expected final answer or the task's internal expected-page list.

Runs are stored in versioned browser localStorage. They are available only in the browser that created them and may be lost when browser data is cleared. No AI simulation executes; customer actions, evidence collection, and courtroom agents remain planned work.

## Deterministic retrieval

Phase 4 adds `/retrieval`, a manual playground for section-level search over the local FlowPilot knowledge base. The index is derived from existing page sections, summaries, keywords, categories, and callouts rather than maintaining a second copy of product facts.

Queries are lowercased, stripped of common punctuation, collapsed, tokenized, deduplicated, and filtered through a small stop-word list. Important policy terms such as `not`, `without`, `before`, and `after` remain searchable. A bounded FlowPilot synonym map expands only known concepts such as cancellation, billing, API limits, viewers, audit logs, HIPAA, and exports.

Ranking uses fixed lexical weights for exact phrases and direct or synonym matches in section titles, bodies, page titles, keywords, summaries, and callouts. Results include short excerpts and a readable score breakdown. The same query and filters always produce the same order.

Configured run pages use the customer question to display the top three retrieval suggestions. These suggestions do not represent customer actions, do not alter run state or action counts, and do not expose internal expected answers. Embeddings and semantic retrieval are deliberately deferred until deterministic behavior has been evaluated.
