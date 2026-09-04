# Trial by User Evaluation Report

## Evaluation setup

- Evaluation version: 1.0.0
- Benchmark: flowpilot-v1
- Mode: deterministic
- Provider/model: fixture / none
- Tasks: 6
- Trials per task: 1
- Timestamp: 2026-09-04T06:09:36.861Z
- Git commit: 1972abce9c1146b50c517944f82231de81262fcf

## Executive summary

| Metric | Result |
| --- | ---: |
| Retrieval Recall@3 | 91.7% |
| Retrieval MRR | 0.92 |
| Fixture customer completion | 100.0% |
| Fixture answer fully supported | 100.0% |
| Fixture required evidence seen | 100.0% |
| Evidence source integrity | 100.0% |
| Fixed-argument citation validity | 100.0% |

## Retrieval

Recall@1 66.7%, Recall@3 91.7%, Recall@5 100.0%, and MRR 0.92. Required-section coverage in the top five is 100.0%.

| Task | First relevant rank | Coverage@5 | Pass |
| --- | ---: | ---: | --- |
| trial-cancellation | 2 | 100.0% | Yes |
| api-allowance | 1 | 100.0% | Yes |
| refund-after-renewal | 1 | 100.0% | Yes |
| hipaa-suitability | 1 | 100.0% | Yes |
| viewer-permissions | 1 | 100.0% | Yes |
| audit-log-export | 1 | 100.0% | Yes |

## Synthetic customer

The deterministic decision fixtures completed 100.0% of runs; 100.0% were fully supported. Correct successful runs used 61.2% of their action budget on average, with a median of 4.0 actions.

## Evidence

Source integrity 100.0%; required representation 100.0%; seen/unseen correctness 100.0%; deduplication 100.0%; deterministic consistency 100.0%.

## Courtroom

Across 10 human-authored fixed cases, citation validity is 100.0%, claim citation coverage is 100.0%, seen/unseen integrity is 100.0%, and shared-evidence integrity is 100.0%. These deterministic checks measure grounding, not rhetorical quality.

## Failure analysis

- No failures were detected in the layers that ran.

## Limitations

- The benchmark is small, controlled, and uses the fictional FlowPilot product.
- Mechanical answer grading is bounded to trusted phrase and negation rules; it is not full semantic grading.
- Live model behavior is nondeterministic, so repeated trials may differ.
- Free-tier provider limits and transient provider failures may affect live runs.
- These metrics do not prove real-world product usability or replace research with real customers.
