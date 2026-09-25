# Pactra Brand

## Idea

A pact is two parties agreeing to limits. Pactra's identity borrows from paper contracts and ledgers: warm paper, black ink, one seal colour, hairline rules. Nothing glows, floats or animates on hover. The interface should feel like a well-set document you can act on.

## The mark

Two square corner brackets, one for each party, offset so their bounds overlap. A solid seal-coloured square sits only inside the overlap.

- Top-left bracket: the creator, who sets the budget.
- Bottom-right bracket: the agent, who receives bounded rights.
- Square: the escrow. Funds exist only where both bounds agree.

Source: `ui/src/components/ui.tsx` (`Brandmark`, `SealDiagram`), favicon `ui/public/pactra-mark.svg`.

Rules: square caps, mitred joins, no rounding, no gradients. Keep clear space equal to one bracket stroke length. The square is always seal colour; the brackets are always ink.

## Wordmark

`pactra`, lowercase, Outfit 600, tracking -0.03em, set to the right of the mark.

## Colour

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#eeeae2` | `#171816` | Page background |
| `--sheet` | `#f4f1ea` | `#1e1f1c` | Raised surfaces |
| `--ink` | `#1c1d1b` | `#e9e4d8` | Text, rules, primary buttons |
| `--rule` | `#cac4b7` | `#34352f` | Hairlines |
| `--seal` | `#c2461f` | `#de5c33` | The mark, current step, one primary action per screen |
| `--ok` | `#2e5e45` | `#7db393` | Settled, healthy |
| `--warn` | `#8f6412` | `#d6a64b` | Simulation, pending |
| `--bad` | `#8f2317` | `#e7705a` | Failed, refunded |

Seal is used sparingly. Status colours always come with a text label, never colour alone.

## Type

- Outfit for everything readable. Display sizes at weight 500 with tight negative tracking.
- JetBrains Mono only for hashes, addresses and step numbers.
- Tabular numerals on.

## Components

- Square corners everywhere. 1px borders instead of shadows.
- Status uses ledger marks: filled square (done), half square (in progress), empty square (pending), crossed square (failed). No icon library, no emoji.
- Notices are fully bordered boxes with a title line. No coloured side stripes.
- Loading uses skeleton bars.
- Hover changes colour instantly. No motion on hover.

## Voice

Plain, short, specific. Say what happens and what the user should do next. No em dashes, no hype, no "it's not X, it's Y" constructions. Label simulated data as simulation.
