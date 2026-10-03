# Supabase setup for ADAMARKET

Project: `nmskpqugwiwdcukqckcy`

## What is already applied

The project already contains the ADAMARKET core schema, storage buckets, favorites RLS, moderation protection and prior security migrations. The new `prod_hardening_roles_and_rls` migration additionally:

- adds validated 9–14 digit INN format checking;
- prevents ordinary users from changing `account_type` through profile updates;
- adds private security-definer role helpers with an empty search path;
- restricts advertising-place creation to `business` (or `admin`);
- restricts producer creation to `manufacturer` (or `admin`);
- restricts advertiser requests to `advertiser` (or `admin`);
- keeps ownership checks for updates/deletes;
- restricts subscriptions created directly by users to `pending` status.

## Edge Function

`adamarket-web-api` is deployed with `verify_jwt=false` because the endpoint has public GET actions for approved places and plans. All POST actions perform explicit bearer-token validation with `supabase.auth.getUser()` and then enforce the profile role on the server.

The function reads `SUPABASE_SERVICE_ROLE_KEY` only from the Edge Function environment. Never put that secret in frontend code, Android assets, GitHub source, or documentation.

## Storage

The existing `adamarket` and `ad-images` buckets allow JPEG/PNG/WebP and cap individual files at 10 MB. Uploads through `adamarket-web-api` are stored under `<user-id>/<uuid>.<ext>` and require a valid authenticated session.

## Required production secrets

Configure these as GitHub Actions Secrets/Environment Variables when release signing or server-side CI is enabled:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY` (server/Edge Function only)

Do not commit any of these values.

## Release signing

The current workflow intentionally produces an installable debug APK and an unsigned release APK. A production release APK/AAB should be added only after the keystore secrets are configured in GitHub Actions. The keystore must never be committed to the repository.
