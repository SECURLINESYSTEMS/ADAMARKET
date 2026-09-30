# ADAMARKET — Production Hardening

## 1.1.3

- `index.html` now uses `window.AdamarketState` as the single frontend state source.
- Legacy lexical state and `window.*` state aliases were removed from the source flow.
- Guest search remains public; protected actions require an authenticated session.
- Authentication fields are resolved explicitly with `document.getElementById`.
- Leaflet remains the canonical coordinate picker; map clicks write latitude/longitude directly.
- Business ad forms include area (m²) and allowed advertising formats.
- Source-level `updatePlace` preserves existing images, cover image, reach and traffic metadata.
- Legacy Android runtime patch injection files were removed; Android now loads the canonical branch source directly.
- Android GPS permission and multi-image picker remain implemented natively.
- `create_producer` exists in the live `adamarket-web-api` Edge Function and enforces the manufacturer role server-side.

## 1.1.2

- Backend role/RLS enforcement verified against the live Supabase schema.
- INN validation enforced in PostgreSQL for 9–14 digits.
- Owner-only update/delete rules and admin override verified for advertising places and producer records.
- Advertiser-only request creation enforced by RLS.
- Android WebView security and explicit GPS permission flow retained.
- Multi-image picker and image validation/compression retained in the Android demo layer.
- Leaflet remains the canonical coordinate picker; the hardening layer no longer replaces it with a cross-origin Yandex iframe.
- Release signing configuration supports GitHub Secrets without committing a keystore.

## Remaining before release

- Complete the GitHub Actions approval/run for the latest source state.
- Run the complete frontend smoke matrix and Android build from the final branch head.
- Configure release signing secrets and build a signed APK/AAB.
- Execute device-level checks for login, registration, GPS, photo picker, map, editing, favorites and promotion payment request.

## Security notes

- No service-role key, database password, JWT secret, or keystore is stored in the repository.
- The browser uses only the publishable Supabase key; authorization is enforced by Auth, Edge Function checks, and RLS.
- An unsigned release APK is not a production artifact.
