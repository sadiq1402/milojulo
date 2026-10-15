# Brand and colour

## Palette: Orchid pop (chosen)
A clean pink-tinted white carries bright orchid, with butter and lilac as stickers and highlights. No browns or grays (the first palette, rosewood and ochre on beige, read as a government site).

| Token | Hex | Use |
|---|---|---|
| orchid | #CC2E86 | Buttons, links, active states, hero screens |
| orchidDark | #8E1F60 | Pressed state, text on tints |
| tint | #FFE3F1 | Match note, selected rows, Dating tag |
| tintStrong | #FFC6E0 | Blobs, badges |
| ground | #FFF7FB | App background |
| card | #FFFFFF | Cards, sheets |
| ink | #2B1233 | Text |
| secondary | #6D5876 | Captions |
| line | #F3DDEA | Dividers |
| butter | #FFE27A | Highlights, stickers |
| butterSoft | #FFF1B8 | Tag background |
| lilac | #C8B6FF | Second accent |
| violet | #7B4DFF | "Julo" in the wordmark |
| danger | #C62828 | Report and delete only |
| warnTint | #FFE3DC | Warning background |
| warnInk | #8B1D1D | Text on warnTint |
| field | #E9CFE0 | Input, chip and secondary-button borders |
| tagNeutral | #FBEAF3 | Plain tag, segmented-control track |
| tagNeutralInk | #4A2F55 | Text on a plain tag |
| selected | #FFF1F8 | Selected option card, match note |
| handle | #EBD3E2 | Bottom-sheet handle |
| track | #F6DFEC | Unfilled progress segment |
| scrim | ink at 50% | Behind bottom sheets |
| photoInitial | ink at 42% | Initial on a photo placeholder |
| lilacSoft | #E3D4FF | Second prompt card on a profile (same hex as the Casual tint, as in the ProfileDetail mockup) |

Mode tints (tags and chips only, never buttons): Friends #CFF1E5 / #0B4A3E; Activities #FFF1B8 / #2B1233; Networking #D6ECFF / #1F4E79; Dating and Serious #FFE3F1 / #8E1F60; Casual #E3D4FF / #4B2BB8.
Photo placeholder tones: #FFD1E8, #E3D4FF, #FFE9A8, #CFF1E5.
Activity card tones (by type, as in the Activities mockup): Sports #FFE9A8, Food & chai #CFF1E5, Outdoors #E3D4FF, Games #FFD1E8, Learning #D6ECFF.
Balance: tinted whites about 70% of a screen, orchid about 16%, butter and lilac about 14%.

## Style
Floating cards with soft orchid shadows instead of borders, pill buttons and inputs, full-colour welcome screen with tilted sticker chips, photo-forward feed cards, colour-coded filter chips, tab bar with a pill-highlighted active icon, soft pink and butter shapes behind plain screens.

## Why this direction (research summary)
Surveys (mostly Western, informal) show women lean toward purple and softer tints and dislike orange, brown and gray; pink alone is not the favourite. Gen Z trend reports favour digital lavender, butter yellow and pastel-plus-bright combinations. Competitors: Tinder pink-orange, Bumble yellow, Hinge black-and-white with plum. Validate with 5 to 8 women in Pune before locking it.

## Logo (decided, decision 32)
- The logo is design/brand/logo.png (1316 x 1195, transparent PNG): two figures forming an M under a heart, gradient orange to pink to violet to blue, with the "MiloJulo" wordmark ("Milo" white, "Julo" gradient) and the line "Connect Beyond Swipes." Founder's choice (2026-10-15): use it as is, heart included.
- The white "Milo" and tagline only read on dark or photo backgrounds; on light screens place the logo on a dark or gradient surface.
- In the app (loader, Welcome) the logo drops the "Connect Beyond Swipes." tagline (the source file keeps it): mark and wordmark only, on the dark brand surface (ink to orchid dark); the icon and launch screens use the mark only, on ink (decision 36). scripts/brand-assets.sh makes every image from logo.png.
- App icon rules: 1024 x 1024 master; Android adaptive icon 108 dp canvas with key artwork inside the 66 dp safe zone; keep shapes bold, no thin lines or small text.
- Still to do: trademark search (IP India device/logo search, reverse image search, adjacent classes, probably apps, software and social/dating services). The word "Milo" is crowded (Nestlé MILO beverages; a MILO software filing by Zuora; other apps named Milo), so check "MiloJulo" as a whole. Not legal advice.

## Fonts
Bricolage Grotesque (display) and Figtree (text), both Google Fonts.
