# Quiz Bonus Questions

This document is the source of truth for the planned bonus-question behavior in
the Learn quiz.

## Purpose

Bonus questions break up the regular card-by-card rhythm and give the learner
occasional general review across the deck. They are rewards, not extra card
practice attempts.

## When bonus questions appear

- Bonus questions are available in both `active` (start learning) and `learned`
  (review) quiz modes.
- The first visible question is always a regular question; a bonus question can
  never occupy the first quiz position.
- When the quiz starts, the session precomputes the bonus slots. Each regular
  question boundary has a one-in-three chance of receiving one bonus slot.
  Slots are anchored to regular-question indexes, so the schedule is known
  before the first question is shown.
- A bonus question is inserted after the regular question that triggered it.
- Bonus questions do not trigger additional bonus questions. This keeps the
  flow finite and prevents a chain of bonus questions.
- The selected quiz size counts regular questions only. For example, a 10-card
  quiz with two bonus questions shows 12 questions in total, but its progress
  bar remains a 10-question progress bar.

## GPT generation and fallback

- The precomputed schedule marks selected bonus slots as either `gpt` or
  `fallback`. The first question and all regular-question progress remain
  independent of this choice.
- As soon as the quiz starts, GPT bonus questions for all scheduled `gpt` slots
  are requested in the background. The quiz must never wait for these requests.
- Every GPT response is validated against the bonus-question schema before it
  can be shown. Invalid JSON, an invalid question/answer, a timeout, or any API
  error marks that slot as unavailable.
- Each scheduled slot has a local, non-GPT fallback question ready from the
  start. If its GPT question is not valid and ready when the slot is reached,
  the fallback is shown immediately.
- A late GPT response never replaces a bonus question already shown. It may be
  discarded for that session; it must not reorder the quiz or delay the learner.
- GPT generation and fallback selection use the current quiz language and
  answer-direction rules, and their source card still does not receive a
  practice-progress write.

## Question pool

- A bonus question is not tied to the card currently being practiced.
- Its source pool is the user's full inventory for the current learning
  language, including both learned and active cards. Custom cards in that
  inventory are included as well.
- The question may use any supported general-review question format, but it
  must carry an explicit `isBonus` marker so quiz persistence cannot treat it
  as ordinary card practice.
- The current quiz's language and answer-direction rules still apply; only the
  card scope is broadened.

## Implemented formats

Bonus slots rotate through four formats:

1. **Four-pair matching** — four target-language terms are matched with their
   meanings. Selecting an already matched item first removes its old match, so
   the learner can correct a pairing before checking.
2. **Sentence order** — GPT may create a short example sentence using the
   learner's cards. The sentence is split into movable tokens; the local
   example-sentence builder is shown immediately while GPT is pending or
   invalid.
3. **Category sorting** — GPT may choose three categories and nine supplied
   cards, three per category. The local card-group catalog is the fallback and
   always validates that every card is used once.
4. **Odd one out** — a local card group is shown with four members and one
   outsider. This format does not depend on the learner's inventory.

Every format has its own check button. Answers are scored only after checking;
correct answers grant `5` bonus points, while incorrect answers grant nothing
and never remove anything. Bonus points are persisted in the existing
`quiz_result_points` total with a unique `(session, bonus)` record so retries
cannot duplicate the reward.

## Progress and persistence rules

- Correct bonus answers never advance a card's correct-count or learned
  threshold.
- Incorrect bonus answers never decrement a card's correct-count and never
  change a card's learned/active status.
- No `practice_attempts` row or equivalent card-progress write is created for
  a bonus answer.
- The regular quiz question count, progress bar, and completion count ignore
  bonus questions.

## Reward and result rules

- A correct bonus answer grants bonus points to the user. The exact point value
  is a separate product constant and must not be implemented by mutating card
  progress.
- An incorrect bonus answer grants no bonus points and causes no card or point
  loss.
- Both correct and incorrect bonus answers are still real answer outcomes for
  the session's streak logic. They can therefore continue or break the streak
  according to the existing streak rules.
- Bonus answers also participate in the result screen's five-tier rating. The
  rating must account for their correctness while the progress denominator
  remains the number of regular questions.
- The result screen may show the number of bonus questions, but must not present
  them as additional learned cards or additional card progress.

## Bonus-question intro

- Every bonus question is preceded by a separate full-screen intro. It is not
  the regular learn-question intro and has its own animation timing and visual
  state.
- The intro label is localized for all supported locales (`BONUS SORU` in
  Turkish, with the corresponding localized label in other locales).
- The intro background starts larger than its normal size with opacity `0`,
  then smoothly drops/scales into its normal size while becoming opaque.
- The intro text also starts oversized and transparent, but follows the
  background by a short delay. The background animation always begins first;
  the text animation follows immediately afterward.
- On exit, the background and text fade smoothly to opacity `0` while scaling
  smaller than their normal size, creating a falling-away 3D impression. The
  same short stagger is preserved: background first, text second.
- Entry and exit timings must remain separate from the regular question intro;
  no element may teleport between states.

## Implementation guardrails

- Keep bonus-question selection and answer handling in the quiz engine rather
  than duplicating the rules in the UI.
- Represent regular and bonus questions separately in the session state, or
  attach `isBonus: true` to the bonus question, so every card-progress write is
  guarded by that marker.
- Award bonus points idempotently per quiz session and bonus question id; a
  rerender, retry, or result-screen reopen must not award the same bonus twice.
- The UI should make the transition feel like a short review break while
  preserving the regular quiz progress indicator and card context.
