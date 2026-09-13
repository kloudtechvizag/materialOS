# Image licenses

Every photograph on the MaterialOS public site is downloaded and stored locally (`apps/web/public/photos/`, `apps/web/public/screenshots/`) -- never hotlinked. This file tracks provenance for every externally-sourced (non-MaterialOS-generated) image.

## Industry photos (`apps/web/public/photos/*.webp`)

| Asset | Source | License | Downloaded | Where used |
|---|---|---|---|---|
| `building_materials.webp` | Unsplash | Unsplash License (free for commercial/noncommercial use, no permission or attribution required) | 2026-09-09 | `/industries/building_materials` hero banner |
| `retail.webp` | Unsplash | Unsplash License | 2026-09-09 | `/industries/retail` hero banner |
| `pharmacy.webp` | Unsplash | Unsplash License | 2026-09-09 | `/industries/pharmacy` hero banner |
| `printing_press.webp` | Unsplash | Unsplash License | 2026-09-09 | `/industries/printing_press` hero banner |

**Known gap:** the exact per-photo source URL and photographer credit were not recorded when these were originally sourced (commit `67c32be`) -- only the license terms and search intent survive in that commit's message. The Unsplash License itself doesn't require attribution, so this isn't a compliance problem, but it means these 4 can't be traced back to their exact original listing if that's ever needed. Anything added going forward should fill in every column below at download time.

**Deliberately not sourced:** a photo for "Mobile Store" (`mobile` industry slug) -- every reasonable search kept surfacing Apple Store imagery (iPhone displays, EarPods, MagSafe wallets on Apple's own oak tables), which would misleadingly imply a partnership that doesn't exist. Better to have 4 genuinely fitting photos than 5 with one being wrong. The other ~19 industries in `ALL_INDUSTRIES` don't have dedicated long-form pages yet, so there's nothing to illustrate for them.

## Pillar composite photos (`apps/web/public/photos/pillars/*.webp`)

| Asset | Source | License | Composited | Where used |
|---|---|---|---|---|
| `mobile-first-field-sales.webp` | User-provided (background photo extracted from a since-deleted AI-generated composite) | Provided directly by the project owner | 2026-09-14 | `/why-materialos` opener grid |
| `real-time-intelligence.webp` | User-provided (same source) | Provided directly by the project owner | 2026-09-14 | `/why-materialos` opener grid |
| `one-business-graph.webp` | User-provided (same source) | Provided directly by the project owner | 2026-09-14 | `/why-materialos` opener grid |
| `connected-commerce.webp` | User-provided (same source) | Provided directly by the project owner | 2026-09-14 | `/why-materialos` opener grid |

**Important:** the *background* photos (people, construction site, factory floor, office, retail store) came from a composite the project owner supplied directly -- their provenance/license is whatever the owner already has for that source image, not independently verified here. The *screen content* in each is not part of that source at all: the original composite had AI-generated, garbled fake software UI baked into every device screen (the "MaterialOS" wordmark itself was misspelled), which was rejected outright and never published. Each device screen was instead perspective-composited with a real crop from `apps/web/public/screenshots/*.webp` (dashboard/quotations/customers/inventory -- real captures, see below), with the person's hand/finger kept in front of the screen via an exclusion mask. If the background-photo source's license is ever in question, replace it -- the compositing script (perspective warp + occlusion mask) is reusable against any replacement background.

## Product screenshots (`apps/web/public/screenshots/*.webp`)

Not externally sourced -- real captures of the actual running MaterialOS app against the seeded `sribalaji-demo` tenant, never a mockup. See `apps/web/src/marketing/screenshots.ts` for the registry and its own staleness tracking, and this repo's README ("Updating marketing screenshots") for the capture procedure.

## Template for new entries

```
| Asset | Source | Creator | Source URL | License | Downloaded | Attribution required | Where used |
```

Fill in every column at download time -- that's the traceability gap the existing 4 industry photos have and new ones shouldn't repeat.

## What NOT to add here

Generic stock-photo categories requested in isolation (warehouse/logistics/retail-counter imagery for empty states, dashboard decoration, onboarding screens) were evaluated and declined for now:

- **Product-catalogue images** (POS/quotation/product-master photos) must be the *tenant's own* uploaded product, never a generic stock photo standing in for it -- see ADR-019. Not an internet-image-acquisition task.
- **Empty-state illustrations**: the app's `EmptyState` component already has a consistent, deliberate icon-based convention (Lucide icon + short copy) used on every list page. Swapping to downloaded illustrations would be a real design-system change, not an additive asset -- confirmed with the user to keep the current convention.
