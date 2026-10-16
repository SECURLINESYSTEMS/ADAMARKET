const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('crm-saas-local/app/app.mjs', 'utf8');
const config = fs.readFileSync('config.js', 'utf8');
const androidManifest = fs.readFileSync('android-demo/app/src/main/AndroidManifest.xml', 'utf8');

function assert(ok, msg) {
  if (!ok) throw new Error(msg);
}

assert(html.includes('<title>ADAMARKET CRM'), 'CRM title missing');
assert(html.includes('id="emailLoginForm"'), 'email login form missing');
assert(html.includes('id="phoneLoginForm"'), 'phone login form missing');
assert(html.includes('id="googleLoginButton"'), 'Google login entry point missing');
assert(html.includes('id="createOrgForm"'), 'organization onboarding form missing');
assert(html.includes('id="customerForm"'), 'customer management form missing');
assert(html.includes('id="workItemForm"'), 'request management form missing');
assert(html.includes('id="taskForm"'), 'task management form missing');
assert(html.includes('id="dealForm"'), 'deal management form missing');
assert(html.includes('id="inviteForm"'), 'team invitation form missing');
assert(html.includes('src="/config.js"'), 'production client configuration must load');
assert(html.includes('src="/crm-saas-local/app/app.mjs"'), 'CRM browser module must load');
assert(!html.includes('127.0.0.1:54324'), 'local Mailpit link must not be shown in production');
assert(app.includes('db: { schema: "crm_saas" }'), 'client must use the isolated CRM schema');
assert(app.includes('signInWithOAuth'), 'Google OAuth workflow missing');
assert(app.includes('verifyOtp'), 'phone OTP verification workflow missing');
assert(app.includes('createSignedUrl'), 'private attachment signed URL workflow missing');
assert(!app.includes('service_role'), 'service-role credentials must never appear in browser code');
assert(config.includes('supabaseUrl:'), 'Supabase URL missing from public config');
assert(config.includes('publishableKey:'), 'publishable key missing from public config');
assert(!config.includes('service_role'), 'service-role credentials must never appear in public config');
assert(fs.existsSync('android-demo/app/src/main/java/uz/adamarket/app/MainActivity.java'), 'Android source must remain present');
assert(androidManifest.includes('<manifest'), 'Android manifest is missing or invalid');
assert(fs.existsSync('404.html'), 'site fallback page missing');
console.log('CRM production entry smoke tests passed');
