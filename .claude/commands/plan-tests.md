---
description: Explore the live app with the Playwright planner agent and save a test plan under specs/
argument-hint: <feature, e.g. "Leave module">
allowed-tools: Task, Bash, Read, Write, Glob, Grep
---

Produce a test plan for: **$ARGUMENTS**

Invoke the `playwright-test-planner` subagent with this prompt:

<plan>
  <task-text>$ARGUMENTS</task-text>
  <seed-file>tests/seed.spec.ts</seed-file>
  <plan-file>specs/<kebab-case-name-of-the-feature>.plan.md</plan-file>
</plan>

The seed file leaves the browser signed in as Admin on the dashboard, so the planner starts from an
authenticated session — it must not plan a login step for non-auth scenarios.

When it returns, summarise the plan's suites and test cases, flag any case that would **write** to
the shared demo, and tell me the plan file path. Do not generate tests yet.
