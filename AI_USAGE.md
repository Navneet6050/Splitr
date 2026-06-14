# AI Usage Log

## Tools Used

- Codex for repository audit, system design, implementation, and verification.
- Local terminal commands for file inspection, Convex code generation, and linting.

## Prompts Used

- "Read the assignment and expenses data, then see my repo ai-splitwise what extra things needed?"
- "Produce a complete High-Level Design and Low-Level Design."
- "Implement this."

## Cases Where AI Needed Correction

1. Initial design would have been too broad if it rebuilt the app. The repo audit showed existing auth, groups, expenses, and settlements should be preserved.
2. The initial import design could silently skip rows with suggested `skip`. This was corrected so skipping requires a saved review decision.
3. The existing schema embedded splits and members. The implementation avoids breaking it by adding normalized tables beside existing fields.

## Human-Reviewed Engineering Choices

- Additive schema migration.
- Staged import before canonical writes.
- Explicit anomaly review.
- Import-time currency conversion audit.
- Historical memberships for imported participants.
