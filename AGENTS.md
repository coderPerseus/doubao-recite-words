<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Workspace map

- `apps/web`: Next.js Web adapter. Read the relevant local Next.js docs before editing it.
- `packages/core`: Shared vocabulary domain model and learning-state rules. Put answer checking and progress semantics here so Web and CLI stay consistent.
- `packages/cli`: Human and Agent command-line adapter. Keep `--json` output machine-readable and backward-compatible.
- `skills/chatwords-learn`: Stateful Skill wrapper. It must call the CLI and must not edit the global state file directly.

The CLI and Skill share `~/.chatwords/state.json`. Use `CHATWORDS_HOME` only for isolated profiles and tests.
