ADAMARKET standalone web app. Telegram Mini App is not required. Uses Supabase Auth and the ADAMARKET web API.

## Local web preview

Serve the repository root with any static web server, for example `python3 -m http.server 8080`, then open `http://localhost:8080`. The public demo uses the Supabase publishable key in the browser; server-side authorization and RLS must remain enabled in Supabase.

## Android demo

The Android WebView project is in `android-demo/`. Build with `./gradlew :app:assembleDebug` from that directory after installing Android SDK 35. The GitHub Actions workflow installs the SDK and uses the committed Gradle Wrapper.

## Required verification

Before release, verify login, registration with 9–14 digit INN, guest search, protected actions, favorites, language persistence, GPS permission flow, logout, ad editing, image upload and payment-request creation. Release signing must use a private keystore stored outside the repository.
