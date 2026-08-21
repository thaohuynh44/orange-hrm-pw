# Test Title Format — design proposal

Scope: how `test.describe()` and `test()` titles are written. No behaviour, no structure, no
locators. Measured against all 79 tests in 19 describe blocks on 2026-08-21.

## Problem

Part of the premise does not survive measurement, so start with what is **already consistent** —
none of this needs fixing:

| Property                     | Result  |
| ---------------------------- | ------- |
| Titles containing `should`   | 0 / 79  |
| Titles embedding a tag (`@`) | 0 / 79  |
| Duplicate titles             | 0       |
| Present tense, active voice  | 79 / 79 |

The inconsistency is real but narrower than "all tests". It sits in two places.

**1. Describe blocks use three separators and four naming schemes.**

| Scheme                        | Count         | Examples                                                                                        |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `<Module> - <Screen>`         | 10            | `PIM - Employee List`, `Admin - System Users`                                                   |
| `<Actor> session - <concern>` | (of those 10) | `ESS session - restricted routes`                                                               |
| `Flow: <outcome>`             | 1             | `Flow: new hire to ESS access`                                                                  |
| bare screen                   | 3             | `Dashboard`, `My Info`, `Login`                                                                 |
| bare concern                  | 5             | `Session handling`, `ESS provisioning`, `Employee lifecycle`, `Agent seed`, `module navigation` |

So `Admin - System Users` carries a module prefix while `My Info` and `Login` — equally modules —
do not, and the two journeys in `tests/flows/` are named two different ways (`Flow: …` and
`Employee lifecycle`).

**2. Test titles use five grammatical shapes.**

| Shape                      | Count | Example                                             |
| -------------------------- | ----- | --------------------------------------------------- |
| verb-first predicate       | 40    | `prefills a generated employee id`                  |
| subject-first, lowercase   | 19    | `the session survives a page reload`                |
| subject-first, Capitalised | 14    | `System Users is served, and queries the users API` |
| gerund-first               | 4     | `filtering by employee name returns that employee`  |
| degenerate                 | 2     | `seed`, `authenticate as admin`                     |

First character: 65 lowercase, 14 uppercase. Length: median 43, max 77, four titles over 70.

**The finding that shapes the recommendation:** the verb-first / subject-first split is _not_
random. It tracks what the describe names. Where the describe is a **screen**, the title is a
predicate and the describe is its subject — `PIM - Add Employee › prefills a generated employee id`
reads as one sentence. Where the describe is a **concern or a role** (`permitted routes`,
`restricted routes`), the describe is not a grammatical subject, so the title supplies its own:
`Admin session - permitted routes › System Users is served`. Both readings are correct. A single
universal shape would have to break one of them.

**What it costs today:** a reader scanning the HTML report cannot predict the shape, and every new
test is a coin flip. Nothing mechanical is affected — verified that all `npm run test:*` scripts and
the CI workflow select by **tag**, never by title, so retitling breaks no automation.

## Options

**A. Leave it alone.** Zero risk, zero churn. But titles are the primary UI of the HTML report and
the CI log, five shapes across 79 tests is already hard to scan, and the cost of fixing it is a
day of mechanical edits with a test count as the safety net. Worth doing.

**B. One universal shape — verb-first predicate everywhere.** Simplest possible rule. It forces the
33 subject-first titles into predicates hanging off describes that cannot be their subject:
`Admin session - permitted routes › serves System Users`. Thirty-three titles get worse so one rule
can get simpler. Rejected.

**C. Two shapes, keyed to what the describe names.** Codify the correlation that already exists,
normalise the describe blocks, and fix the genuine outliers. Roughly 12 edits rather than 79.

**D. C, plus lint enforcement.** `playwright/valid-title` is **already active at error level** via
`playwright.configs['flat/recommended']`, and its schema accepts `disallowedWords`, `mustMatch` and
`mustNotMatch` per `describe` / `test` / `step`. The mechanical half of the convention can enforce
itself instead of relying on review.

## Recommendation: C + D

### Describe titles

`<Scope> - <Subject>` — one hyphen, spaces around it, always.

- **Scope** is the module as the side menu names it (`PIM`, `Admin`, `Auth`, `Dashboard`), or the
  actor for role suites (`Admin session`, `ESS session`), or `Journey` for anything in `tests/flows/`.
- **Subject** is the screen as the app names it, or the concern under test.
- Omit the scope only when it would repeat the subject — `Dashboard`, never `Dashboard - Dashboard`.
- Nested describes name a sub-concern and take no scope prefix, but are still capitalised.

| Now                                  | Proposed                           |
| ------------------------------------ | ---------------------------------- |
| `Login`                              | `Auth - Login`                     |
| `Session handling`                   | `Auth - Session`                   |
| `Flow: new hire to ESS access`       | `Journey - new hire to ESS access` |
| `Employee lifecycle`                 | `Journey - employee lifecycle`     |
| `ESS provisioning`                   | `ESS session - provisioning`       |
| `module navigation` (nested)         | `Module navigation`                |
| `Dashboard`, `My Info`, `Agent seed` | unchanged                          |
| the ten `X - Y` blocks               | unchanged                          |

### Test titles

One sentence. Present tense, active voice. No `should`, `can`, `will`, `correctly` or `properly`.
Tags go in the `tag` option, never in the title. Target ≤ 72 characters. State the observable
outcome, not just the action, wherever the outcome is the point of the test.

Shape follows the describe:

- **Describe names a screen** → verb-first predicate; the describe is the subject.
  `PIM - Add Employee › prefills a generated employee id`
- **Describe names a concern, a role, or a journey** → subject-first sentence, because the describe
  is not a subject. `Admin session - permitted routes › System Users is served, and queries the users API`

Capitalise the first word only when it is a UI label the app itself capitalises — `System Users`,
`Cancel`, `My Info`. That accounts for all 14 uppercase titles today and is worth keeping: they are
literal strings from the screen, and lowercasing them would misquote the app.

Gerund-first titles (`filtering by employee name returns that employee`) are a valid subject-first
form where the subject is an action. Keep them.

### The two degenerate titles

- `Agent seed › seed` says nothing. It is the file the AI subagents run first, so name its contract:
  `Agent seed › signs in and lands on the dashboard`.
- `Employee lifecycle › an employee can be hired, amended and then deleted` — drop the modal verb:
  `Journey - employee lifecycle › an admin hires, amends and then deletes an employee`.

`global.setup.ts › authenticate as admin` is not a spec and is exempt.

### Lint

```js
'playwright/valid-title': ['error', {
  disallowedWords: ['should', 'must', 'correctly', 'properly'],
  mustNotMatch: {
    test: ['@', 'tags belong in the tag option, not in the title'],
  },
  mustMatch: {
    describe: ['^[A-Z]', 'describe titles start with a capitalised scope'],
  },
}],
```

Deliberately **no `mustMatch` on `test`**. A regex cannot tell an informative title from a
compliant one, and a rule that rewards satisfying the pattern over describing the behaviour would
make the report worse. The length target stays a review convention; this rule cannot express it.

## Blast radius

| Item                         | Count                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Tests in the suite           | 79 — **must still be 79 afterwards**                                                                                  |
| Describe blocks renamed      | 6                                                                                                                     |
| Test titles edited           | 2 degenerate + up to 4 over-length = 6                                                                                |
| Spec files touched           | 6 of 13 (`auth/login`, `auth/session`, `dashboard/dashboard`, `flows/*` ×2, `access-control/ess-role-access`, `seed`) |
| Config touched               | `eslint.config.mjs`                                                                                                   |
| Docs touched                 | `CLAUDE.md` conventions list, `README.md` "Adding a test"                                                             |
| Tests downstream of a rename | 23 (their full reported path changes; their behaviour does not)                                                       |

Nothing else depends on a title string. Verified: every `npm run test:*` script and the CI workflow
select by tag. The single literal-title reference in the repo is `CLAUDE.md`'s example
`-g "reset clears the applied filters"`, and that title is already conformant and does not change.

## Migration order

Each step leaves the suite green on its own and can be reverted alone.

1. **Add the lint rule with only `disallowedWords` and `mustNotMatch`.** Both already hold (0 uses
   of `should`, 0 tags in titles), so this passes immediately and locks in what is true today.
   Verify: `npm run lint`.
2. **Rename the six describe blocks**, one file at a time. Verify after each:
   `npx playwright test --list | tail -1` still reads 79.
3. **Fix the two degenerate titles and trim the four over 70 characters.** Same verification.
4. **Add `mustMatch: { describe: ['^[A-Z]'] }`.** This step passes only after step 2 capitalises the
   nested `module navigation` block — sequencing matters.
5. **Document the convention** in `CLAUDE.md`'s conventions list and the README's "Adding a test".

Retitling cannot change behaviour, so the test count is the real check; run `npm run test:readonly`
once at the end because six spec files were edited, and `npm run verify` after every step.

## What would make this a bad idea

- **It touches six spec files for zero behavioural gain.** If anyone has work in flight on those
  files, this is a pure merge conflict with nothing to show for it. Land it on a quiet tree or not
  at all.
- **Uniformity is not the goal; legibility is.** If the two-shape rule starts producing stilted
  sentences because someone is serving the rule rather than the reader, the rule has failed and
  option A was right. The `mustMatch` on test titles was omitted for exactly this reason.
- **The screen-vs-concern judgement is a judgement.** People will disagree on which a given describe
  is. The cost of getting it wrong is one slightly awkward sentence, which is acceptable — but if it
  turns into recurring review argument, the rule is too clever.
- **The 72-character target cannot be enforced** by `valid-title` and will drift unless reviewers
  care about it. Treat it as guidance, not a gate.
