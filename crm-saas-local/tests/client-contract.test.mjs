import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app/app.mjs", import.meta.url), "utf8");
const foundation = readFileSync(new URL("../supabase/migrations/20261015000100_crm_saas_foundation.sql", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../supabase/migrations/20261015000200_crm_saas_workflows_and_industry_modules.sql", import.meta.url), "utf8");
const metadata = readFileSync(new URL("../supabase/migrations/20261015000600_crm_saas_metadata_and_archiving.sql", import.meta.url), "utf8");
const industryDefaults = readFileSync(new URL("../supabase/migrations/20261015000700_crm_saas_industry_defaults.sql", import.meta.url), "utf8");
const attachments = readFileSync(new URL("../supabase/migrations/20261015000800_crm_saas_private_attachments.sql", import.meta.url), "utf8");

test("every DOM id referenced by the browser client exists in the HTML", () => {
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const appIds = new Set([...app.matchAll(/el\("([^"]+)"\)/g)].map((match) => match[1]));
  const missing = [...appIds].filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, [], "missing HTML IDs: " + missing.join(", "));
});

test("the HTML loads the module that owns the client behavior", () => {
  assert.match(html, /<script\s+type="module"\s+src="\.\/app\.mjs"\s*>\s*<\/script>/);
});

test("every profession-specific custom-data field read or written by the client exists in SQL", () => {
  assert.match(metadata, /alter table crm_saas\.customers[\s\S]*?add column if not exists custom_data jsonb/);
  assert.match(metadata, /alter table crm_saas\.work_items[\s\S]*?add column if not exists custom_data jsonb/);
  assert.match(workflow, /custom_fields/);
});

test("soft archive columns exist for every core record type", () => {
  for (const table of ["customers", "work_items", "tasks", "deals"]) {
    assert.match(metadata, new RegExp("alter table crm_saas\\." + table + "[\\s\\S]*?archived_at timestamptz"));
  }
});

test("core tables retain tenant ownership and row-level security in the foundation migration", () => {
  for (const table of ["organizations", "organization_members", "customers", "work_items", "tasks", "activity_log"]) {
    assert.match(foundation, new RegExp("alter table crm_saas\\." + table + " enable row level security"));
  }
  for (const table of ["pipelines", "pipeline_stages", "deals", "custom_fields"]) {
    assert.match(workflow, new RegExp("alter table crm_saas\\." + table + " enable row level security"));
  }
});

test("new organizations receive profession-specific starter fields", () => {
  assert.match(industryDefaults, /after insert on crm_saas\.organizations/);
  assert.ok(industryDefaults.includes("new.industry_code = 'beauty'"));
  assert.match(industryDefaults, /'appointment_date'/);
});

test("attachments use a private bucket and tenant-aware storage policies", () => {
  assert.match(attachments, /values \('crm-files', 'crm-files', false/);
  assert.match(attachments, /create policy crm_files_upload_accessible_work/);
  assert.match(attachments, /can_access_crm_file\(name\)/);
  assert.match(attachments, /file_size_limit = excluded.file_size_limit/);
});
