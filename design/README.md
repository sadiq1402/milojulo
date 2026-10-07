# Design

- `tokens.ts` / `tokens.json`: colours, spacing, radius, type and component sizes ("Orchid pop"). Import these instead of hard-coding values.
- `reference-html/screens/`: static HTML mockups of all 29 screens (390 x 844; `Admin` is a web page). They use a design-tool runtime tag (`<x-dc>`) and a missing `support.js`, so they are for reading, not running. Every colour, size and radius in them matches the tokens.
- `reference-html/brand/`: colour system, UI standards boards and logo explorations (Logos for Orchid pop, Logo system). The logo is not final; see docs/06-brand-colour.md.

Private links to the live design canvas and the V1 plan doc are in the root README.

Translating a mockup to React Native: take sizes from tokens, build shared components first (Button, Input, Chip, Tag, Card, ListRow, Avatar, TabBar, TopBar, Sheet, Bubble), then screens. Use hit slop where the visual size is below 48.
