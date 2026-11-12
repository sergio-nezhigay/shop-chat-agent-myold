# Answer-quality eval

Replays ~25 real-style customer questions against the **live** bot and grades the answers.
Cost: Haiku API calls only (≈ $0.5 per full run). Grading is done in Claude Code, not via the API.

## Run
```
node tools/eval/run.mjs --label baseline          # all cases
node tools/eval/run.mjs --label after --only surface-1769,acer-a515-56
```
Output: `tools/eval/results/<stamp>-<label>.json` (answer text, char count, tool calls).
Test conversations get ids `eval-<label>-…`; skip them when reviewing real chats.

## Grade (in Claude Code)
Ask a Sonnet subagent to grade the results file against `questions.json` and `other.rules.md`
(the owner's policy: required lines, known laptops, traps), using this rubric, and write
`results/<stamp>-<label>.score.md`:

- 5 — correct verdict and facts, right product, required lines present, short (≤ ~450 chars), right language.
- 4 — correct, one small miss (a missing required line, slightly long, extra product).
- 3 — usable but notable miss (no product offered when one exists, vague warranty, English fragments).
- 2 — misleading (wrong plug/RAM type, wrong verdict on a trap, invented certainty).
- 1 — wrong or harmful ("we don't have it" when we do, says incompatible thing works), or error.

Score table: id | score | main issue. Then total /125 and the tool-call count (cost signal).
Compare with the previous score file; a change ships only if total ≥ baseline and no case drops by 2+.
