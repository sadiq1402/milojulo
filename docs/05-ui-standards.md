# UI standards

All sizes in logical points (iOS) / dp (Android); text in sp so it scales with the system font setting. Reference frame 390 x 844; support 360 to 430 wide. The static mockups in design/reference-html/screens follow these values. The values are tokens in design/tokens.ts (and tokens.json); the app reads them through apps/mobile/src/theme and builds the components below in apps/mobile/src/components (the chat bubble is apps/mobile/src/screens/chat/MessageBubble.tsx).

## Layout
- Base unit 4, rhythm 8. Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Page margin 20. Block gap 16. Section gap 24. Grid gutter 12. Card padding 16.
- Safe areas: reserve 48 for the status bar and 34 at the bottom in mockups; in code use the real insets.

## Touch targets
Visual size at least 40; hit area at least 48 x 48 (iOS minimum is 44, Android 48), with at least 8 between targets. Extend small controls with hit slop. Icons: 16 tiny, 20 inline, 24 default, 32 feature, stroke 1.8.

## Radius
16 code boxes and thumbnails; 20 text areas and option cards; 24 cards, lists, tab bar; 28 feed cards and sheets; 32 hero photo; Full (pill) for buttons, inputs, segmented controls, chips, tags, avatars.

## Type (Bricolage Grotesque for display, Figtree for text)
| Style | Size / line | Font |
|---|---|---|
| Display | 40 / 44 | Bricolage Grotesque 700 |
| H1 | 28 / 32 | Bricolage Grotesque 700 |
| H2 | 20 / 24 | Bricolage Grotesque 700 |
| Title | 17 / 24 | Figtree 600 |
| Body | 16 / 24 | Figtree 400 |
| Body small | 14 / 20 | Figtree 400 |
| Label (buttons) | 16 / 20 | Figtree 700 |
| Caption, tags, tab labels | 12 / 16 | Figtree 500 to 700 (never below 12) |
| Code digit | 24 / 32 | Figtree 600 |

## Components
| Element | Standard |
|---|---|
| Top bar | 56 high below the inset; 48 x 48 buttons with 24 icons; title 17/24 centred; padding 0 8 |
| Tab bar | 56 + 34 inset = 90; 5 tabs max; 24 icon and 12/16 label 4 apart; active icon in a 56 x 32 orchid-tint pill; radius 24 top, soft shadow, no border |
| Primary / secondary button | 52 high, pill, padding 0 24, 16/20 bold; primary has a soft orchid shadow; 8 between stacked buttons |
| Compact button | 44 high, min width 88, hit area padded to 48 |
| Text button | 48 high, orchid label |
| Input | 52 high, pill, padding 0 20, text 16/24; label 14/20 semibold 6 above |
| Text area | 96 min, radius 20, padding 12 16 |
| Code box | 56 high, 48 wide min, 8 gaps, radius 16 |
| Chip | 40 high, radius 20, padding 0 16, 14/20; 8 gaps; hit area 48 via hit slop |
| Tag | 28 high, pill, padding 0 10, 12/16 semibold; not tappable |
| Segmented control | 52 container, 44 segments, pill, 4 padding |
| Card | Radius 24 (feed cards 28), padding 16, no border, soft shadow, 16 between cards |
| Feed media | 7:6, 350 x 300 on a 390 screen, location chip bottom-left, mode tag top-right |
| List row | 56 min, padding 8 16, 12 between parts, 1 divider |
| Avatars | 28 inline, 36 chat header, 44 sheets, 48 rows, 72 profile; thumbnail 64 radius 16 |
| Photos | Stored 4:5 (min 1080 x 1350); profile hero 350 x 437 radius 32; upload slots 169 x 211 radius 20 |
| Bottom sheet | Radius 28 top; handle 40 x 5, 12 from top; padding 12 20 + 34 inset; max height 90% |
| Switch / checkbox / radio | Switch 52 x 32; checkbox and radio 24 visual (checkbox radius 6), row at least 48; option card 64 min, radius 20 |
| Progress (onboarding) | 4 high segments, 6 gaps, 20 side margins |
| Chat bubble | Radius 22 (6 on tail corner), padding 10 14, 16/22, max width 78%; incoming bubbles on a soft shadow |
| Chat media | Max 240 wide, 4:3 |
| Composer | Input 48 high, radius 24; buttons 48 x 48; padding 10 12, bottom 10 + 34 inset |
| Unread dot | 10, orchid |
| Tab badge | 20 min (pill), padding 0 4, orchid with white 12/16 caption, on the icon pill's top-right corner |
| Stepper | − value +: 48 x 48 round buttons with a 1 field-colour border and 20 icons, value 17/24 centred between them, 8 gaps; label 14/20 semibold 6 above |

## Web admin
8-point grid, sidebar 232 wide, table rows 48 to 56, same colour and type tokens.

## Accessibility
Text contrast 4.5:1, icons 3:1; test at 130% font scale; every tappable element has an accessible label.
