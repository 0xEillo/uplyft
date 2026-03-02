---
name: code-simplifier
description: Simplify and refine existing code while preserving exact behavior. Use when asked to clean up, refactor, standardize, or improve readability/maintainability of recently modified code without changing functionality.
---

# Code Simplifier

Refine recently modified code for clarity, consistency, and maintainability while preserving exact runtime behavior.

## Workflow

1. Identify scope
- Target files changed in the current session or recently modified files requested by the user.
- Avoid broad repo-wide refactors unless explicitly requested.

2. Preserve behavior
- Keep all observable behavior, outputs, and feature coverage identical.
- Avoid logic changes, data-flow changes, API contract changes, and side-effect changes.

3. Apply refinement standards
- Use ES modules with sorted imports and explicit extensions when project conventions require them.
- Prefer `function` declarations over arrow functions where appropriate for consistency.
- Add explicit return type annotations for top-level TypeScript functions.
- Use explicit React `Props` types for components.
- Prefer explicit, readable control flow over compact expressions.
- Avoid nested ternaries; use `if/else` chains or `switch` for multi-branch logic.
- Remove redundant abstractions and dead/redundant code.
- Keep naming clear and consistent with local conventions.
- Remove comments that restate obvious code behavior.

4. Keep balance
- Do not over-compress code or introduce clever patterns that reduce readability.
- Keep concerns separated; avoid stuffing unrelated logic into one function.
- Preserve useful abstractions that improve comprehension and testability.

5. Verify confidence
- Check for behavior drift risks in control flow, async paths, error handling, and typing.
- Run available targeted checks/tests when feasible.
- If tests cannot run, state that clearly.

## Output Rules

- Make minimal diffs with high readability impact.
- Document only significant refinements that affect understanding.
- If no meaningful simplification is possible, say so directly.
