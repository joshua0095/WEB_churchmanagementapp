# Jesus Is Lord Church App — Color Palette

A high-contrast, modern palette built on the church's navy/gold identity.

## Palette

| Role | Usage | Hex | Preview |
|---|---|---|---|
| Navy | Headers, nav bars, primary text on light bg | `#0B1C33` | ⬛ |
| Gold | Primary buttons, active states, CTAs only | `#F2B705` | 🟨 |
| Off-White | App background | `#FAFAF7` | ⬜ |
| Cool Gray | Cards, borders, dividers | `#E7E9EC` | ⬜ |
| Slate | Secondary / muted text | `#4A5568` | ⬛ |
| Sky Blue | Links, info states, secondary accents | `#3B82C4` | 🟦 |

## CSS Custom Properties

Drop this into your global stylesheet (e.g. `:root` in `index.css` or a `theme.css`):

```css
:root {
  /* Brand */
  --color-navy: #0B1C33;
  --color-gold: #F2B705;

  /* Surfaces */
  --color-bg: #FAFAF7;
  --color-surface: #FFFFFF;
  --color-border: #E7E9EC;

  /* Text */
  --color-text-primary: #0B1C33;
  --color-text-secondary: #4A5568;
  --color-text-on-navy: #FFFFFF;
  --color-text-on-gold: #0B1C33;

  /* Accent / state */
  --color-info: #3B82C4;
  --color-danger: #B5342A;
  --color-success: #2F855A;
}
```

## Usage Guidelines

- **Gold is a CTA-only color.** Reserve it for primary actions (Log In, Sign Up, Add, Save). Don't use it for decorative accents or it loses meaning.
- **Navy carries structure.** Headers, nav bars, and bottom tab bars. Body text on light backgrounds should also default to navy (`--color-text-primary`) rather than pure black — it keeps the palette cohesive.
- **Off-white background, not cream.** This palette intentionally drops the cream/parchment tone from earlier drafts for a cleaner, more contemporary feel. Cards sit on `--color-surface` (white) with a `--color-border` hairline, not a drop shadow, to stay flat and modern.
- **Sky blue is for links and informational states only** — not buttons. This avoids confusion with the primary gold CTA.
- **Contrast check:** Navy (`#0B1C33`) on off-white (`#FAFAF7`) and white on navy both pass WCAG AA for body text. Gold (`#F2B705`) needs dark text on top (`#0B1C33`), never white — white-on-gold fails contrast.

## Do / Don't

| Do | Don't |
|---|---|
| Gold button with navy text | Gold button with white text (fails contrast) |
| Navy headers on off-white background | Navy on cream (mixing this with the old palette) |
| Sky blue for a "learn more" link | Sky blue for a primary action button |
| One gold CTA per screen | Multiple gold elements competing for attention |
