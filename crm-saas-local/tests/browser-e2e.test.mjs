import assert from "node:assert/strict";
import { chromium } from "playwright";

const appUrl = process.env.CRM_E2E_APP_URL || "http://127.0.0.1:3000";
const mailpitUrl = process.env.CRM_E2E_MAILPIT_URL || "http://127.0.0.1:54324";
const email = "crm-e2e-owner@example.test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ acceptDownloads: true });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function waitForMailLink() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const listResponse = await fetch(mailpitUrl + "/api/v1/messages");
    assert.equal(listResponse.ok, true, "Mailpit message list should be available");
    const listing = await listResponse.json();
    const messages = (listing.messages || []).filter((item) =>
      JSON.stringify(item.To || []).includes(email)
    );
    if (messages.length) {
      const detailResponse = await fetch(mailpitUrl + "/api/v1/message/" + encodeURIComponent(messages[0].ID));
      assert.equal(detailResponse.ok, true, "Mailpit should return the magic-link email");
      const detail = await detailResponse.json();
      const bodies = [detail.HTML, detail.Text].filter((value) => typeof value === "string").join("\n");
      const candidates = [
        ...bodies.matchAll(/https?:\/\/[^\s"'<>]+/g)
      ].map((match) => match[0].replace(/&amp;/g, "&").replace(/&quot;/g, '"'));
      const link = candidates.find((candidate) => candidate.includes("/auth/v1/verify"));
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for the Supabase magic-link email in Mailpit");
}

async function waitForText(selector, text) {
  await page.waitForFunction(
    ({ selector, text }) => document.querySelector(selector)?.textContent?.includes(text),
    { selector, text },
    { timeout: 15_000 }
  );
}

async function waitForStatus(text) {
  await waitForText("#status", text);
}

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#emailLoginForm [name=email]").fill(email);
  await page.locator("#emailLoginForm button[type=submit]").click();
  await waitForStatus("Ссылка для входа отправлена");
  const magicLink = await waitForMailLink();
  await page.goto(magicLink, { waitUntil: "domcontentloaded" });
  await page.locator("#appPanel").waitFor({ state: "visible", timeout: 20_000 });

  await page.locator("#createOrgForm [name=name]").fill("CRM E2E Company");
  await page.locator("#createOrgForm [name=slug]").fill("crm-e2e-company");
  await page.locator("#createOrgForm [name=industry_code]").selectOption("service_installation");
  await page.locator("#createOrgForm button[type=submit]").click();
  await waitForStatus("Компания создана");
  await waitForText("#organizationInfo", "service_installation");

  await page.locator("#customerForm [name=display_name]").fill("E2E Test Customer");
  await page.locator("#customerForm [name=phone]").fill("+998901112233");
  await page.locator("#customerForm button[type=submit]").click();
  await waitForStatus("Клиент сохранён");
  await page.locator("#customerList").getByText("E2E Test Customer", { exact: true }).waitFor();

  await page.locator("#workItemForm [name=title]").fill("E2E Test Request");
  await page.locator("#workItemForm [name=customer_id]").selectOption({ label: "E2E Test Customer" });
  await page.locator("#workItemForm [name=description]").fill("Browser end-to-end verification");
  await page.locator("#workItemForm button[type=submit]").click();
  await waitForStatus("Заявка создана");
  const requestRow = page.locator("#workItemList tr").filter({ hasText: "E2E Test Request" });
  await requestRow.waitFor({ state: "visible" });

  await page.locator("#taskForm [name=work_item_id]").selectOption({ label: "E2E Test Request" });
  await page.locator("#taskForm [name=title]").fill("E2E Test Task");
  await page.locator("#taskForm button[type=submit]").click();
  await waitForStatus("Поручение создано");
  await page.locator("#taskList").getByText("E2E Test Task", { exact: true }).waitFor();

  await page.locator("#dealForm [name=title]").fill("E2E Test Deal");
  await page.locator("#dealForm [name=customer_id]").selectOption({ label: "E2E Test Customer" });
  await page.locator("#dealForm [name=amount]").fill("125000");
  await page.locator("#dealForm button[type=submit]").click();
  await waitForStatus("Сделка создана");
  await page.locator("#dealList").getByText("E2E Test Deal", { exact: true }).waitFor();

  await requestRow.locator('input[type=file]').setInputFiles({
    name: "e2e-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("private CRM attachment end-to-end test")
  });
  await requestRow.getByRole("button", { name: "Загрузить файл" }).click();
  await waitForStatus("Файл прикреплён к заявке");
  const refreshedRequestRow = page.locator("#workItemList tr").filter({ hasText: "E2E Test Request" });
  await refreshedRequestRow.getByRole("button", { name: "Открыть: e2e-note.txt" }).waitFor();

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#customerList tr").filter({ hasText: "E2E Test Customer" }).getByRole("button", { name: "В архив" }).click();
  await waitForStatus("Клиент перемещён в архив");
  await page.locator("#showArchivedToggle").check();
  const archivedCustomer = page.locator("#customerList tr").filter({ hasText: "E2E Test Customer" });
  await archivedCustomer.getByRole("button", { name: "Восстановить" }).waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await archivedCustomer.getByRole("button", { name: "Восстановить" }).click();
  await waitForStatus("Клиент восстановлен");

  assert.deepEqual(pageErrors, [], "browser should not raise uncaught JavaScript errors");
  console.log("CRM browser E2E passed: email auth, company setup, customer/request/task/deal CRUD, private attachment upload, archive and restore.");
} finally {
  await browser.close();
}
