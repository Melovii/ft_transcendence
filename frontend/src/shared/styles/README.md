# shared/styles

The application imports one stylesheet, `index.css`. It declares the cascade layers, pulls
in Tailwind's theme, preflight and utilities, and then the three project files:

- `theme.css` — the design tokens. Every design value lives here, in a single `@theme`
  block, so Tailwind generates its utilities from the design system.
- `base.css` — document defaults in `@layer base`: page background, body type, heading
  scale, link color and the focus ring.
- `utilities.css` — the few patterns utility composition cannot express on the element
  itself, each declared with `@utility`.

## Tokens

Tokens come from the design system variables in `ui-design/ui.pen`, which is the
authoritative source for every color, size, radius, stroke, shadow and type value. Names
follow the handoff rule: a variable's segments are lower-cased and joined with hyphens, so
`Color / Primary` is `--color-primary`, `Radius / 2XL` is `--radius-2xl`, `Stroke / Heavy`
is `--stroke-heavy` and `Typography / Size / LG` is `--font-size-lg`.

Most namespaces map straight onto Tailwind's own, so a token is also a utility:

| Token                 | Utility                      |
| --------------------- | ---------------------------- |
| `--color-primary`     | `bg-primary`, `text-primary` |
| `--font-size-lg`      | `text-lg`                    |
| `--radius-md`         | `rounded-md`                 |
| `--spacing-3`         | `p-3`, `gap-3`, `mt-3`       |
| `--shadow-card`       | `shadow-card`                |
| `--font-weight-black` | `font-black`                 |
| `--tracking-tight`    | `tracking-tight`             |

Type sizes keep their `--font-size-*` names and are aliased into Tailwind's `--text-*`
namespace, so `text-lg` and `var(--font-size-lg)` are the same value.

Stroke widths and z-index have no Tailwind namespace, so they stay custom properties and
are applied directly: `border-(length:--stroke-medium)` and `z-(--z-modal)`.

## Rules

- Components style themselves with utility classes. A raw color, radius, spacing or shadow
  value never appears in a component.
- A value that is missing from the theme is added to `theme.css` from the design system,
  not written inline.
- `--spacing-1`..`--spacing-6` are the design system's scale (4, 8, 16, 24, 32, 48px). Any
  other step falls back to the 4px base, which keeps the two consistent.
- Icons are not a font. They render as SVG through `shared/ui/Icon` and inherit font size
  and `currentColor`, so they are sized and colored with the same utilities as text.
