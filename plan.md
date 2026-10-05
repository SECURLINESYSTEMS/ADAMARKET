# ADAMARKET — Marketplace roadmap

## Benchmark boundaries

ADAMARKET uses publicly observable marketplace patterns as product inspiration, not copied OLX branding, text, layout, assets, or code. The independent product position is **Tashkent advertising inventory with AI-assisted matching**, free beta publishing, owner verification, moderation, and multilingual support.

## Findings from the public OLX Uzbekistan experience

- Broad category discovery and location-aware browsing are the core entry point.
- Search is supported by category/location/price-oriented filtering and listing recency.
- A listing flow needs structured fields, photos, seller information, moderation, and clear publication status.
- A user area needs saved listings/searches and management of own listings.
- Buyer–seller communication, sharing, reporting, and safety controls are central marketplace operations.
- Mobile parity matters: create from camera/gallery, browse, save, share, manage, and communicate.
- Paid promotion is a later monetization layer; ADAMARKET beta keeps it disabled.

## ADAMARKET implementation decisions

1. Keep the Premium Dark Tashkent identity and AI matching instead of imitating OLX visual design.
2. Use Supabase Auth, RLS-protected tables, Storage, and Edge API as the permanent backend.
3. Make new user listings enter `pending`; admin/moderator approves or rejects them.
4. Use a structured search panel: category, district, price ceiling, unit, recency, and sort.
5. Add an expanded listing detail view with gallery, location, trust badges, share/report, and protected contact/request actions.
6. Store requests in `public.requests` with advertiser and place ownership; remove public temporary `/api` dependencies from the live web flow.
7. Add profile settings and own-listing status management; show admin moderation only to privileged users.
8. Android WebView loads the HTTPS production domain so web and APK share one product version.
9. Keep payment and promotion controls hidden in beta; no payment is collected.

## Design direction

- **Movement:** premium dark editorial marketplace.
- **Principles:** fast scanning, high trust, calm hierarchy, and local Tashkent context.
- **Palette:** deep navy for confidence, electric blue for actions, mint for verification, amber only for moderation warnings.
- **Layout:** asymmetric hero/search entry, compact filter rail, dense listing cards, and bottom navigation on mobile.
- **Signature elements:** glossy category icons, skyline hero, and consistent verification/status chips.
- **Voice:** direct and helpful; e.g. “Найдём место под ваш бюджет” and “Разместите рекламное место бесплатно в beta”.
