---
name: chatwords-learn
description: Continue stateful English vocabulary practice through the chatWords CLI. Use when the user asks to背单词, learn or review words, continue a previous vocabulary session, check vocabulary progress, switch word books, answer a chatWords question, or skip the current word.
---

# chatWords Learn

Use the `chatwords` CLI as the only interface to learning state. The CLI persists progress globally in `~/.chatwords/state.json`, so every invocation continues the same learner history.

## Continue a lesson

1. Run `chatwords status --json`.
2. If an unfinished session exists, run `chatwords current --json`.
3. If no session exists:
   - Run `chatwords books --json`.
   - Use the word book named by the user.
   - When the user gave no preference, start `workplace` with `chatwords start workplace --json`.
4. Present exactly one prompt from the returned `prompt` object. Include the Chinese meaning, English definition, masked example, position, and hint when present. Do not invent extra clues.
5. Wait for the user's answer.
6. Submit the exact answer with `chatwords answer <answer> --json`.
7. Report the returned feedback briefly. If `prompt` contains the next word, present it in the same response and wait again.

## Other actions

- Skip only when the user asks: `chatwords skip --json`.
- Start a new shuffled round only when requested: `chatwords start <bookId> --new --json`.
- Switch books with `chatwords start <bookId> --json`. This resumes that book's unfinished round when possible.
- Show progress with `chatwords status --json`.
- List choices with `chatwords books --json`.

## State rules

- Never read or edit `~/.chatwords/state.json` directly.
- Never guess whether an answer is correct; the CLI owns normalization, aliases, wrong-attempt counts, skips, and progress updates.
- Never reveal the answer before the CLI returns it after a correct answer or skip.
- Treat an incorrect answer as normal practice, not a command failure.
- Keep one global learner state. Only use `CHATWORDS_HOME` when the user explicitly asks for an isolated profile.
- If `chatwords` is missing, explain that the project installer must be run once with `pnpm skill:install`; do not create an alternate state store.
