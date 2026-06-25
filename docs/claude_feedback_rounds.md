# Claude Feedback Loop Tracker

Maximum rounds: 5.

Purpose: Track Claude critique, Codex review, user decisions, and resulting changes.

## Round Status

| Round | Claude Feedback Received | Codex Review Done | User Decision Needed | Changes Applied | Status |
|---:|---|---|---|---|---|
| 1 | Yes | Yes | Later | Yes | Sent for round 2 |
| 2 | Yes | Yes | Later | Yes | Sent for round 3 |
| 3 | Yes | Yes | Later | Yes | Sent for round 4 |
| 4 | Yes | Yes | Later | Yes | Sent for round 5 |
| 5 | Yes | Yes | Yes | No further spec changes | Complete |

## Process

For each round:

1. Send `docs/claude_review_packet.md` or the updated packet to Claude.
2. Paste Claude's feedback into this Codex thread.
3. Codex classifies each item as `apply`, `defer`, `reject`, or `needs user decision`.
4. Codex applies accepted changes.
5. Codex updates this tracker.
6. Stop after round 5 or when no major critique remains.

## Decision Rules

- Apply immediately when feedback fixes a clear data integrity, automation, learning flow, or usability issue.
- Ask the user when feedback changes mission tone, scope, technology stack, budget, or release schedule.
- Defer when feedback is useful but belongs after PWA/card/PPT renderer implementation.
- Reject when feedback weakens the mission goal or adds complexity without practical benefit.

## Round 1

Claude feedback:

```text
Stored in docs/claude_round1_raw.md.
```

Codex review:

```text
Stored in docs/claude_round1_codex_response.md.
```

Changes:

```text
Added phrase review status fields, PWA localStorage policy, image licensing placeholders, keyword tiers, source hashes, and TTS acoustic review protocol. Regenerated learning asset index and output specs.
```

## Round 2

Claude feedback:

```text
Stored in docs/claude_round2_raw.md.
```

Codex review:

```text
Stored in docs/claude_round2_codex_response.md.
```

Changes:

```text
Added PWA statePolicy and keyword display fields to split specs, created acoustic review result placeholder, clarified Kakao scope, added Saturday teacher context header, improved week 1 ministryGuide entries, and regenerated all output specs.
```

## Round 3

Claude feedback:

```text
Stored in docs/claude_round3_raw.md.
```

Codex review:

```text
Stored in docs/claude_round3_codex_response.md.
```

Changes:

```text
Added explicit localStorage key schema, PWA image placeholder fallback, learner profile UX defaults, Sunday Kakao review_recap content mode, and regenerated all specs.
```

## Round 4

Claude feedback:

```text
Stored in docs/claude_round4_raw.md.
```

Codex review:

```text
Stored in docs/claude_round4_codex_response.md.
```

Changes:

```text
Added Sunday Kakao content source rules, contentSource fields in Kakao specs, PWA audio speed control placement, and regenerated all specs.
```

## Round 5

Claude feedback:

```text
Stored in docs/claude_round5_raw.md.
```

Codex review:

```text
Stored in docs/claude_round5_final_verdict.md.
```

Changes:

```text
No structural blocker remained. Feedback loop closed at max 5 rounds.
```
