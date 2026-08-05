# Trial by User product specification

## Product concept

Trial by User is an agentic product-testing application. A synthetic customer receives a narrow task and product-specific information, attempts to reach a conclusion, and leaves an auditable trail. A prosecutor argues that the experience failed, a defense argues that it succeeded, and a judge returns an evidence-grounded verdict and recommendation.

The courtroom framing creates a disciplined evaluation process: claims must point to observable evidence, opposing interpretations are considered, and the final result is more useful than a generic usability score.

## Target user

The initial user is a product manager, founder, designer, or researcher at an early-stage software company who needs fast, repeatable feedback on a specific product experience before investing in broader customer research. Trial by User supports focused investigation; it does not replace real customer research.

## Main user flow

1. Add product knowledge, initially for a controlled fictional SaaS product and later through documents and screenshots.
2. Define a single customer profile and a narrow, observable task.
3. Start a simulation and watch the synthetic customer reason through the available information.
4. Review the chronological actions, conclusions, and supporting evidence.
5. Compare the prosecutor and defense arguments.
6. Read the judge's verdict, confidence, rationale, and recommended product action.

## Planned frontend screens

- Dashboard and recent test runs
- Product knowledge setup
- Test creation and task definition
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

- A controlled fictional SaaS product as the initial test surface
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
