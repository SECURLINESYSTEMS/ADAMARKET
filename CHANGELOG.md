# ADAMARKET — Production Hardening

## 1.1.2

- Backend role/RLS enforcement verified against the live Supabase schema.
- INN validation enforced in PostgreSQL for 9–14 digits.
- Owner-only update/delete rules and admin override verified for advertising places and producer records.
- Advertiser-only request creation enforced by RLS.
- Android WebView security and explicit GPS permission flow retained.
- Multi-image picker and image validation/compression retained in the Android demo layer.
- Leaflet remains the canonical coordinate picker; the hardening layer no longer replaces it with a cross-origin Yandex iframe.
- Release signing configuration supports GitHub Secrets without committing a keystore.
- Frontend smoke tests are present and will become a release gate after the source state migration is completed.

## Remaining before release

- Complete the source-level state migration in `index.html`: `session`, `profile`, `places`, `myAds`, `favorites`, `plans`, `signup`, `lang`, and `demo` must use `window.AdamarketState` exclusively.
- Move demo-only runtime overrides from Android asset injection into the web source and remove legacy runtime patch injection.
- Configure release signing secrets and build a signed APK/AAB.
- Run the complete device test matrix after the state migration.

## Security notes

- No service-role key, database password, JWT secret, or keystore is stored in the repository.
- The browser uses only the publishable Supabase key; authorization is enforced by Auth, Edge Function checks, and RLS.
- An unsigned release APK is not a production artifact.
