# Evaluation

Trial by User has a local evaluation harness under `eval/`. It measures the controlled FlowPilot system by layer so retrieval quality, model behavior, deterministic evidence integrity, courtroom grounding, judge agreement, end-to-end completion, and provider reliability remain distinguishable. Evaluation code and fixtures do not enter production prompts or browser runtime code.

## Benchmark design

The versioned `flowpilot-v1` manifest transforms the six existing customer tasks and their trusted server-side evaluation specifications. Each case identifies critical concept groups, forbidden claims, required and qualification sources, expected retrieval targets, and deterministically representable answer variants. It deliberately does not define one prose ideal answer.

Pre-recorded customer decisions exercise the real action executor and evidence collector without a provider. A separate set of ten human-authored courtroom fixtures contains two cases for each verdict category: Pass, Pass with friction, Misleading, Blocked, and Insufficient evidence. Each fixed case has a journey outcome, immutable evidence bundle, prosecutor and defense arguments, expected verdict, human rationale, and acceptable confidence values. Expected labels and rationales are evaluation-only.

## Metrics

- **Retrieval:** macro Recall@1, Recall@3, Recall@5, mean reciprocal rank, per-task required-section coverage, ranks, scores, and failures.
- **Synthetic customer:** answer completion, bounded mechanical correctness, detectable grounding failures, correct-run action efficiency, median actions, redundant retrieval actions, and required-evidence discovery.
- **Evidence:** source integrity against trusted FlowPilot content, required-source representation, seen/unseen correctness, canonical deduplication, and normalized deterministic consistency.
- **Courtroom:** citation validity, substantive-claim citation coverage, deterministically detectable seen/unseen assertions, shared-evidence integrity, and live structured-output success.
- **Judge:** exact agreement with human verdict labels, citation validity, recommendation grounding, structured-output success, and descriptive confidence for correct versus incorrect cases. No nearby-category score is reported because no defensible ordinal mapping is currently defined.
- **End to end:** pipeline completion, stricter fully grounded success, average provider calls, and average successful customer actions. The completion rule requires an answer that is not contradicted, successful evidence and both advocates, valid advocate citations, a judge result, and valid judge citations.
- **Reliability:** attempted and successful provider calls plus rate-limit, timeout, authentication/configuration, structured-output, invalid-citation, and other provider failures. Provider attempts remain separate from successful customer actions.

All percentages use a zero-safe denominator. Mechanical correctness maps all supported checks to `fully-supported`, any contradicted check to `contradicted`, any remaining unsupported check to `unsupported`, and absent assessable checks to `not-assessable`.

## Running evaluation

Deterministic evaluation is the default and requires no provider credentials:

```bash
npm run eval
npm run eval:deterministic
```

Live evaluation must name one task or explicitly select all tasks, and must include `--confirm-live`:

```bash
npm run eval:live -- --task trial-cancellation --trials 1 --confirm-live
npm run eval:live -- --all --trials 3 --confirm-live
npm run eval:live -- --all --trials 1 --confirm-live --output-tag groq-gpt-oss
npm run eval:live -- --help
```

Live mode loads the normal `.env.local` files and uses the configured `LLM_PROVIDER` and model. Trials default to one and are hard-capped at five per selected task. The CLI prints the maximum possible provider-call count before creating the provider. Calls are strictly sequential. There is no automatic retry, provider fallback, repair generation, or parallel execution. Selecting one task also limits judge evaluation to human fixtures for that task.

Tests, builds, linting, type checking, and deterministic evaluation never make provider calls. A live command without confirmation or without an explicit task selection exits before provider setup.

## Reports

The default run writes:

- `reports/evaluation/latest.json` — versioned machine-readable results;
- `reports/evaluation/latest.md` — concise human-readable results;
- `reports/evaluation/review.json` — live runs only, with customer journeys, verdicts, recommendations, and blank manual-rating fields.

An output tag replaces `latest` with the tag and writes `review-<tag>.json`, preserving model-comparison runs. Tagged and review artifacts are ignored by Git; the small deterministic `latest` example remains tracked. Reports include no API keys, hidden prompts, or hidden reasoning.

Interpret deterministic metrics as reproducible checks of code and trusted fixtures. Interpret live metrics as model observations for the named provider, model, tasks, and trial count—not as scientific proof. Provider failures are reported independently and should not be mistaken for customer or system-quality failures.

## Limitations

- The benchmark is small and uses a fictional, controlled product.
- Mechanical answer grading is bounded phrase and negation matching, not complete semantic evaluation.
- Human verdict labels are defensible fixtures, not population-level ground truth.
- Live model behavior is nondeterministic.
- Free-tier provider rate limits can affect live results.
- Persona aggregates are descriptive and do not prove persona realism.
- These metrics do not prove real-world UX quality or replace research with real customers.
