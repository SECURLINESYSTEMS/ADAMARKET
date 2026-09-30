# ADAMARKET — Production Hardening

## 1.1.1

- Hardened Android WebView navigation and file/URL access.
- Fixed Android GPS permission flow: the WebView callback is resolved only after the Android permission result.
- Added safe browsing and disabled file/universal file access from WebView.
- Added `prod_hardening.js` for the Android demo: guest search, persistent language, role-aware creation flow, image compression, multi-image upload, full edit flow, and Yandex map display.
- Added manufacturer service creation flow and business-only advertising-place creation at the API boundary.
- Added server-side role checks for advertiser/business/manufacturer/admin actions.
- Added server-side coordinate validation and image type/size validation.
- Payment requests now carry a stable plan identifier for admin confirmation.
- Added database role helpers and tighter RLS policies.
- Android demo version bumped to 1.1.1.
- CI now validates every Android JavaScript patch and builds both debug and unsigned release APKs.

## Security notes

- No service-role key, database password, JWT secret, or keystore is stored in the repository.
- The publishable Supabase key may be used by the browser; authorization is enforced by Supabase Auth, Edge Function checks, and RLS.
- The unsigned release APK is not an installable production artifact. A signed release requires a keystore supplied through GitHub Secrets.
