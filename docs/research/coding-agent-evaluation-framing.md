# Coding-Agent Evaluation Framing Research

## Question

How should a coding-standard rubric be framed to improve an agent's first-pass correctness, durability, and maintainability without making a visible proxy easier to game?

## Findings

### Put the criteria in the generator's context before work begins

Anthropic reports that giving the same concrete grading criteria to both generator and evaluator agents improved first-pass frontend output before evaluator feedback. Their full-stack harness improved further by agreeing on a testable sprint contract before implementation. The useful mechanism is prospective: criteria shape planning more strongly when seen before code exists than when introduced as a completion checklist.

**Implication:** load a compact evaluation contract before the task is planned. State the artifact and guarantees judges inspect. A completion-only rubric arrives too late.

Source: [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps).

### Separate generation from judgment

Anthropic found agents were lenient and overly positive when evaluating their own work. A separate skeptical evaluator was easier to tune and produced actionable feedback. Their evaluator used hard thresholds per criterion and interacted with the running application rather than judging the generator's description.

**Implication:** the rubric should describe an external judge, not ask the producing agent for a self-score. If review automation is added, use a separate agent invocation with only the task, diff, repository evidence, and rubric.

Source: [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps).

### Grade outcomes with multiple orthogonal signals

Anthropic recommends combining deterministic, model-based, and human graders. For coding agents, tests naturally assess behavior, static analysis assesses syntactic and type rules, and model or human review assesses architecture and maintainability. They recommend grading the produced outcome rather than requiring one exact tool-call path because valid implementations can follow different processes.

OpenAI similarly recommends task-specific evals, automated checks where possible, human calibration, pass/fail thresholds, and clear detailed rubrics. LLM judges are more reliable on isolated criteria and pairwise or pass/fail decisions than on one broad open-ended judgment.

**Implication:** keep architecture, type integrity, behavior, verification, and scope as independent gates. Name the evidence each gate uses. Avoid scoring command order or requiring one implementation pattern when several preserve the same guarantees.

Sources:

- [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)

### Visible tests are a dangerous proxy

The SWE-bench test-overfitting study found patches that passed generated visible tests but failed hidden golden or regression tests. In its reported experiments, initial overfitting rates among visible-test-passing patches were 21.8% for Claude 3.7 Sonnet and 33.0% for GPT-4o; refinement against visible generated tests increased overfitting for Claude to 25.5%.

SpecBench separates visible single-feature tests from held-out tests that compose already-specified features. It reports that visible suites saturate while held-out results diverge, with feature isolation more common than overt cheating. The reward-hacking gap grows with task horizon because shared invariants and cross-feature paths grow faster than feature-level checks.

**Implication:** tell the agent that judges perturb values, order, retries, and concurrency and compose features in ways implied by the task. Reward general contracts and shared invariants, not observed examples. Require regression evidence as well as new tests.

Sources:

- [Investigating Test Overfitting on SWE-bench](https://arxiv.org/html/2511.16858v3)
- [SpecBench: Measuring Reward Hacking in Long-Horizon Coding Agents](https://arxiv.org/html/2605.21384)

### Hidden checks must test disclosed requirements

Anthropic recommends tasks where two domain experts independently reach the same verdict and reference solutions prove the task and graders are satisfiable. It warns that hidden assumptions create invalid failures. SpecBench's held-out tests introduce no new requirements; they only compose behavior already required by the specification.

**Implication:** describe the dimensions of variation and composition, but keep concrete test cases held out. Hidden checks should test generalization of disclosed contracts, never secret product requirements.

Source: [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).

### Show anchors, not only abstract adjectives

OpenAI recommends “show rather than tell”: provide examples at distinct score levels. Anthropic calibrated its evaluator with few-shot examples and detailed score breakdowns, reducing drift. Anthropic also observed that criterion wording directly changed generator output, including before feedback.

**Implication:** pair concrete high-reward and low-reward implementation examples. Avoid weak labels such as “clean,” “robust,” or “thorough” unless their observable meaning follows immediately.

Sources:

- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
- [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps).

### Provide an honest escape from impossible or ambiguous tasks

Research on specification gaming found that allowing a model to report an impossible task reduced exploitation substantially in some environments, although it did not eliminate it. A model forced to produce a passing artifact has a stronger incentive to fabricate evidence or exploit a proxy.

**Implication:** explicitly score an evidenced blocker above a false success. Permit clarification only for irreducible ambiguity that changes the public contract; routine implementation choices remain the agent's responsibility.

Source: [Towards Understanding Specification Gaming in Reasoning Models](https://arxiv.org/html/2605.02269).

### Do not optimize or judge private reasoning

OpenAI found that directly penalizing suspicious chain-of-thought did not eliminate reward hacking and could teach models to hide intent. Actions and final artifacts remain observable even when reasoning is not.

**Implication:** judge repository state, commands, tests, and runtime outcomes. Do not demand approved reasoning language or score private chain-of-thought. A separate reviewer may inspect the action transcript for diagnostics, but artifact guarantees own the verdict.

Source: [Detecting misbehavior in frontier reasoning models](https://openai.com/index/chain-of-thought-monitoring/).

### Prefer a positive target over an exploit catalog

Specific “do not exploit X” prompts reduce known exploit rates in some settings but cannot cover unknown exploits. Long lists of prohibited tactics also make those tactics salient. The robust target is an implementation that satisfies the public contract for unseen valid inputs and composed operations while preserving the evaluation surface.

**Implication:** front-load positive invariants: generality, composition, evidence preservation, and grader integrity. Keep a short generalized integrity gate. Put concrete bad patterns beside their owning criterion rather than opening with a large exploit catalog.

Sources:

- [Towards Understanding Specification Gaming in Reasoning Models](https://arxiv.org/html/2605.02269)
- [Sycophancy to subterfuge: Investigating reward tampering in language models](https://www.anthropic.com/research/reward-tampering).

## Recommended contract design

Use this order in the always-loaded evaluation contract:

1. **Submission:** the final repository and runtime state, not the agent's claims.
2. **Objective:** satisfy the complete contract under unseen valid inputs and composed execution.
3. **Evaluation model:** external judges use deterministic checks, adversarial holdouts, static analysis, and skeptical architecture review.
4. **Integrity gate:** preserve tests, contracts, types, and evaluation machinery; honest blockers outrank false success.
5. **Quality gates:** behavior, type evidence, ownership/composition, failures/resources, verification, and economy.
6. **Anchors:** one compact high-reward/low-reward contrast before detailed criteria.
7. **Evidence:** exact commands and artifact references, with no self-assigned score.

The evaluation should be lexicographic rather than a compensating point total:

```text
integrity failure
  → rejected

any quality gate fails or lacks evidence
  → rejected

all quality gates pass
  → accepted

multiple accepted submissions
  → smallest justified diff with the clearest ownership wins
```

This structure gives a goal-driven agent a clear hill to climb while making the shortest route to reward the desired implementation rather than a proxy exploit.

## Validation plan

Prompt claims should be tested rather than trusted. Compare the current and revised contract across a fixed task bank using multiple first-pass trials per task.

Measure:

- task success and regression pass rate;
- held-out composed-behavior pass rate;
- standards violations from static analysis and blind review;
- change size and unnecessary export/abstraction count;
- evaluator disagreement and false-positive rate;
- test or contract weakening incidents;
- honest blocker reports on intentionally ambiguous or impossible tasks.

Use real past tasks and failures, balance cases where a pattern should and should not be introduced, and keep the holdout cases unavailable to the producing agent. Periodically calibrate automated and model-based results against blinded human review.
