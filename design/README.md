# Design

- `tokens.ts` / `tokens.json`: colours, spacing, radius, type, component sizes and shadows ("Orchid pop"); the two files hold the same values. The app imports `tokens.ts` through `apps/mobile/src/theme` (Metro watches `design/`). Use these instead of hard-coding values.
- `reference-html/screens/`: static HTML mockups, 45 files (44 phone screens at 390 x 844, plus `Admin`, a web page). They use a design-tool runtime tag (`<x-dc>`) and a missing `support.js`, so they are for reading, not running. Interface colours match the tokens; the only other colours are the illustration gradients on Activities and Joined, the dashed photo-slot border in Setup2Photos (`#E2BFD5`) and the emergency card in SafetyCentre (`#5A1414` on warnTint with a `#F5C2BA` border). docs/07-screens.md lists which mockups are built.
- `reference-html/brand/`: colour system (ColourSystem), UI standards boards (UiFoundations, UiComponents) and logo boards (LogoSystem, LogoOrchid).
- `brand/`: the logo (decision 32): `logo.png` and the light-surface `logo-orchid.png`. `scripts/brand-assets.sh` makes the app icon, launch screens and in-app images from them; see docs/06-brand-colour.md.

Private links to the live design canvas and the V1 plan doc are in the root README.

Translating a mockup to React Native: take sizes from tokens and build screens from the shared components in `apps/mobile/src/components` (Avatar, BottomSheet, Button, Card, Checkbox, Chip, CodeInput, IconButton, Input and TextArea, ListRow, OptionCard, PhotoPlaceholder, Progress, SegmentedControl, Stepper, Switch, TabBar, Tag, Text, TopBar, and others). Use hit slop where the visual size is below 48.
