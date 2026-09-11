# Calibration workspace surface brief

## Scope and mode

- Primary target: `src/app/(workspace)/calibration/page.tsx`.
- Mode: Operate.
- Audience: HR reviewing an AI assessment after a candidate interview.
- Job: verify each score against source evidence, correct the AI, and explicitly confirm the final decision.

## Chosen direction

- Direction: Evidence Matrix with audit-workpaper review marks.
- Approved comp: `.impeccable/mocks/hirelens-dossier-approved.png`.
- Memorable moment: selecting a competency aligns AI score, HR adjustment, final score, resume excerpt and interview excerpt on one shared baseline.

## Composition inventory

| Ingredient | Medium | Commitment |
| --- | --- | --- |
| Narrow navigation rail | Semantic HTML/CSS + Lucide icons | Deep navy ground; compact labels; current section obvious |
| Ranked candidate list | Semantic list/table | Fixed scan rhythm and visible selection without card stacking |
| Assessment dossier | Semantic table | Competency, evidence claim, AI score, HR adjustment and final state share each row |
| Evidence inspector | HTML/CSS drawer | Warm-paper excerpts with exact source labels; no rasterized text |
| Conflict block | Accessible alert | Red reserved for blocking contradiction; always says 待 HR 核实 |
| Process rail | Ordered list | JD parsing through HR confirmation, one active stage |
| Model trace strip | Description list | Monospaced model, Skill Pack, latency and cost values |
| Primary action | Semantic button | Solid blue 确认评估; disabled until required conflicts are resolved |

## Component grammar

- Corner radius 6–10px; 1px cool-gray rules; elevation only on drawers and dialogs.
- Chinese sans-serif hierarchy: 26/20/16/14/12; monospaced tabular numerals for scores and traces.
- Tight rows with generous column gutters; no nested decorative cards.
- State is expressed by icon, label and color together.

## Responsive behavior

- Desktop: candidate list, dossier and evidence inspector visible together.
- Tablet: candidate list becomes a selector above the dossier.
- Mobile: single-column review sequence with sticky candidate/competency selector and bottom confirmation bar.

## Non-literal translations

- The generated paper texture becomes a subtle CSS surface, never a raster containing UI text.
- Synthetic names and exact values are demonstration content, not claimed customer results.
- The comp is a hierarchy and density contract; responsive layouts may reflow without removing evidence or confirmation steps.
