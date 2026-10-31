---
version: alpha
name: Arrakis
description: Utility-first social feed where indie tools are discovered by the problem they solve and tried in one tap.
colors:
  paper: "#FAF4EA"
  paper-raised: "#FFFFFF"
  paper-sunken: "#EFE6D6"
  ink: "#1B1612"
  ink-muted: "#5C5247"
  line: "#DDD0BB"
  primary: "#C2410C"
  primary-ink: "#FFFFFF"
  sage: "#2F7D4F"
  alert: "#B42318"
typography:
  display:
    fontFamily: Bricolage Grotesque
    fontSize: 28px
    lineHeight: 32px
    fontWeight: 700
  body:
    fontFamily: system-ui
    fontSize: 15px
    lineHeight: 22px
    fontWeight: 400
  caption:
    fontFamily: system-ui
    fontSize: 12px
    lineHeight: 16px
    fontWeight: 500
rounded:
  base: 14px
  pill: 999px
spacing:
  base: 4px
---

## Overview

Arrakis is a short-form feed for indie and student projects. The interface borrows familiar vertical-reel behaviours (snap scrolling, an action rail, a profile shelf) but is its own product: the primary action on every post is **Try it**, not like, and every card states the problem the tool solves. The look is warm desert paper and dark ink with a single ember accent. It is inspired by Instagram's interaction model and must not reuse its logo, gradient, typeface or icon set.

## Colors

One accent (`primary` (ember orange)) per view, reserved for the Try it action and the active navigation item. `sage` signals live-demo health only. Reel overlays use solid translucent `ink` panels, never gradients. Text on `primary` (ember orange) uses `primary-ink`.

## Typography

`display` is for screen titles and the lockup; everything else is `body` or `caption`. Numeric data (tries, uptime, rank, XP) uses tabular figures. Headings use balanced wrapping, paragraphs use pretty wrapping.

## Layout

Mobile first. Bottom navigation (Home, Explore, Create, Ranks, Me) becomes a left rail from 1024px. Full-height containers use `100dvh`. Fixed bars respect safe-area insets. Stacking uses a fixed named scale (base, feed, nav, sheet, toast), never arbitrary z-index values.

## Elevation & Depth

Use the Tailwind default shadow scale sparingly; separate surfaces with `line` borders and `paper-sunken` fills first.

## Shapes

Cards and sheets use `rounded.base`; chips, segmented controls and avatars use `rounded.pill`.

## Components

- **Reason chip:** every feed card shows why it was recommended (followed builder, taste match, cold-start spotlight, trending). It is text-first and links to the referenced builder when one exists.
- **Try it dock:** the single `primary` (ember orange) filled button on the card, always reachable with the thumb.
- **Sheets:** use native `<dialog>` opened as a modal, with Esc and outside-click dismissal.

## Do's and Don'ts

- Do give empty states exactly one clear next action.
- Do keep interaction feedback at or under 200ms and animate only transform and opacity.
- Don't use gradients, glow effects or more than one accent per view.
- Don't copy Instagram branding, iconography or layout one-to-one.
