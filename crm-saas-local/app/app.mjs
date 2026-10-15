import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

const config = window.CRM_CONFIG || {};
const client = config.supabaseUrl && config.publishableKey
  ? createClient(config.supabaseUrl, config.publishableKey, {
      db: { schema: "crm_saas" },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
const db = client ? client.schema("crm_saas") : null;

const el = (id) => document.getElementById(id);
let currentUser = null;
let currentOrg = null;
let organizations = [];
let members = [];
let customers = [];
let workItems = [];
let activities = [];
let attachments = [];
let tasks = [];
let deals = [];
let pipelines = [];
let stages = [];
let invites = [];
let customFields = [];
let inviteAttemptInProgress = false;
let showArchived = false;
let searchText = "";
let pendingInviteToken = new URLSearchParams(window.location.search).get("invite");

const WORK_STATUSES = [
  ["new", "Новая"],
  ["in_progress", "В работе"],
  ["waiting", "Ожидает"],
  ["completed", "Завершена"],
  ["cancelled", "Отменена"]
];
const TASK_STATUSES = [
  ["open", "Открыта"],
  ["in_progress", "В работе"],
  ["done", "Готово"],
  ["cancelled", "Отменена"]
];

function message(text, isError = false) {
  const node = el("status");
  node.textContent = text;
  node.dataset.state = isError ? "error" : "info";
}

function ensureClient() {
  if (!client || !db) {
    throw new Error("Откройте app/config.js и укажите локальный Supabase URL и publishable key. Service-role key сюда не вставлять.");
  }
  return client;
}

function currentOrgId() {
  if (!currentOrg) throw new Error("Сначала выберите или создайте компанию.");
  return currentOrg.organization_id;
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function parseJsonObject(value, label) {
  let parsed;
  try {
    parsed = JSON.parse(value || "{}");
  } catch {
    throw new Error(label + ": введите корректный JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(label + ": требуется JSON-объект, например {}.");
  }
  return parsed;
}

function parseJsonArray(value, label) {
  let parsed;
  try {
    parsed = JSON.parse(value || "[]");
  } catch {
    throw new Error(label + ": введите корректный JSON-массив.");
  }
  if (!Array.isArray(parsed)) throw new Error(label + ": требуется JSON-массив, например [].");
  return parsed;
}

function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value == null ? "" : String(value);
  option.textContent = label;
  select.append(option);
}

function fillSelect(select, rows, valueKey, labelFn, firstLabel) {
  const previous = select.value;
  select.replaceChildren();
  if (firstLabel !== null && firstLabel !== undefined) addOption(select, "", firstLabel);
  for (const row of rows) addOption(select, row[valueKey], labelFn(row));
  if (Array.from(select.options).some((o) => o.value === previous)) select.value = previous;
}

function makeCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value == null || value === "" ? "—" : String(value);
  row.append(cell);
  return cell;
}

function makeButton(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await action();
    } catch (error) {
      message(error.message || String(error), true);
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

function renderTable(targetId, headings, items, buildRow) {
  const target = el(targetId);
  target.replaceChildren();
  if (!items || items.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Пока нет записей.";
    target.append(empty);
    return;
  }
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headings.forEach((heading) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = heading;
    headerRow.append(th);
  });
  thead.append(headerRow);
  table.append(thead);
  const tbody = document.createElement("tbody");
  items.forEach((item) => tbody.append(buildRow(item)));
  table.append(tbody);
  target.append(table);
}

function matchesSearch(values) {
  if (!searchText) return true;
  const haystack = values.filter((value) => value !== null && value !== undefined)
    .map((value) => typeof value === "object" ? JSON.stringify(value) : String(value))
    .join(" ").toLocaleLowerCase();
  return haystack.includes(searchText);
}

function csvCell(value) {
  let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  // Prevent spreadsheet formula execution from user-controlled cell values.
  if (["=", "+", "-", "@"].includes(text[0]) || text.charCodeAt(0) === 9 || text.charCodeAt(0) === 13) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function exportCsv(filename, columns, rows) {
  if (!rows.length) {
    message("Нет записей для экспорта.", true);
    return;
  }
  const content = "\uFEFF" + [
    columns.map((column) => csvCell(column.label)).join(";"),
    ...rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(";"))
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Keep the object URL alive long enough for mobile browsers to begin the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  message("CSV-файл подготовлен: " + filename);
}

function customerName(id) {
  const customer = customers.find((row) => row.id === id);
  return customer ? customer.display_name : "Без клиента";
}

function memberName(id) {
  const member = members.find((row) => row.user_id === id);
  if (!member) return id ? String(id).slice(0, 8) : "Не назначен";
  return member.display_name || member.email || member.phone || String(member.user_id).slice(0, 8);
}

function stageName(id) {
  const stage = stages.find((row) => row.id === id);
  return stage ? stage.name : "Этап не найден";
}

function setAppVisibility(isSignedIn) {
  el("authPanel").hidden = isSignedIn;
  el("appPanel").hidden = !isSignedIn;
  if (isSignedIn && currentUser) {
    el("signedInUser").textContent = "Вошли: " + (currentUser.email || currentUser.phone || currentUser.id);
  }
}

async function acceptPendingInvite() {
  if (!pendingInviteToken || inviteAttemptInProgress) return;
  inviteAttemptInProgress = true;
  try {
    const { error } = await db.rpc("accept_invite", { p_invite_token: pendingInviteToken });
    if (error) throw error;
    pendingInviteToken = null;
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    message("Приглашение принято. Вы добавлены в компанию.");
  } finally {
    inviteAttemptInProgress = false;
  }
}

async function refreshForSession(session) {
  currentUser = session && session.user ? session.user : null;
  setAppVisibility(Boolean(currentUser));
  if (!currentUser) {
    currentOrg = null;
    organizations = [];
    return;
  }
  ensureClient();
  if (pendingInviteToken) {
    try {
      await acceptPendingInvite();
    } catch (error) {
      message("Не удалось принять приглашение: " + (error.message || String(error)) + ". Войдите в аккаунт с приглашённым подтверждённым email/телефоном.", true);
    }
  }
  await loadOrganizations();
}

async function loadOrganizations(preferredId) {
  const { data, error } = await db.from("organization_members")
    .select("organization_id, role, is_active, display_name, email, phone, organization:organizations(name,slug,industry_code,default_currency,locale,timezone,settings)")
    .eq("user_id", currentUser.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  organizations = (data || []).filter((row) => row.organization).map((row) => ({
    organization_id: row.organization_id,
    role: row.role,
    is_active: row.is_active,
    display_name: row.display_name,
    email: row.email,
    phone: row.phone,
    name: row.organization.name,
    slug: row.organization.slug,
    industry_code: row.organization.industry_code,
    default_currency: row.organization.default_currency,
    locale: row.organization.locale,
    timezone: row.organization.timezone,
    settings: row.organization.settings || {}
  }));

  const select = el("organizationSelect");
  select.replaceChildren();
  if (organizations.length === 0) {
    addOption(select, "", "Нет доступных компаний");
    currentOrg = null;
    fillOrgSettingsForm();
    el("organizationInfo").textContent = "Создайте компанию или откройте ссылку-приглашение после входа.";
    await loadOrgData();
    return;
  }
  for (const org of organizations) addOption(select, org.organization_id, org.name + " — " + org.role);
  const wanted = preferredId || (currentOrg && currentOrg.organization_id);
  currentOrg = organizations.find((org) => org.organization_id === wanted) || organizations[0];
  select.value = currentOrg.organization_id;
  el("organizationInfo").textContent =
    "Сфера: " + currentOrg.industry_code +
    "; валюта: " + currentOrg.default_currency +
    "; язык: " + currentOrg.locale +
    "; часовой пояс: " + currentOrg.timezone;
  fillOrgSettingsForm();
  await loadOrgData();
}

function fillOrgSettingsForm() {
  const form = el("orgSettingsForm");
  const canManage = currentOrg && ["owner", "admin"].includes(currentOrg.role);
  form.elements.default_currency.value = currentOrg ? (currentOrg.default_currency || "UZS") : "UZS";
  form.elements.locale.value = currentOrg ? (currentOrg.locale || "ru") : "ru";
  form.elements.timezone.value = currentOrg ? (currentOrg.timezone || "Asia/Tashkent") : "Asia/Tashkent";
  form.elements.settings.value = JSON.stringify(currentOrg ? (currentOrg.settings || {}) : {}, null, 2);
  Array.from(form.elements).forEach((control) => { control.disabled = !canManage; });
}

async function loadOrgData() {
  const orgId = currentOrg ? currentOrg.organization_id : null;
  if (!orgId) {
    members = []; customers = []; workItems = []; activities = []; attachments = []; tasks = []; deals = [];
    pipelines = []; stages = []; invites = []; customFields = [];
    renderAll();
    return;
  }
  const results = await Promise.all([
    db.from("organization_members").select("user_id,role,is_active,display_name,email,phone,joined_at").eq("organization_id", orgId).order("joined_at", { ascending: true }),
    db.from("customers").select("id,display_name,phone,email,company_name,notes,custom_data,archived_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("work_items").select("id,customer_id,title,description,status,priority,assigned_to,due_at,custom_data,archived_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("activity_log").select("id,work_item_id,actor_id,activity_type,details,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("attachments").select("id,organization_id,work_item_id,storage_path,original_filename,content_type,size_bytes,uploaded_by,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200),
    db.from("tasks").select("id,work_item_id,title,description,status,priority,assigned_to,due_at,completed_at,custom_data,archived_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("deals").select("id,pipeline_id,stage_id,customer_id,title,amount,currency,expected_close_date,assigned_to,description,custom_data,archived_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("pipelines").select("id,name,is_default").eq("organization_id", orgId).order("created_at", { ascending: true }),
    db.from("pipeline_stages").select("id,pipeline_id,name,position,probability,is_won,is_lost").eq("organization_id", orgId).order("position", { ascending: true }),
    db.from("organization_invites").select("id,invitee_email,invitee_phone,role,expires_at,accepted_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("custom_fields").select("id,entity_type,field_key,label,field_type,options,is_required,is_active").eq("organization_id", orgId).order("created_at", { ascending: true })
  ]);
  const firstError = results.find((result) => result.error);
  if (firstError) throw firstError.error;
  [members, customers, workItems, activities, attachments, tasks, deals, pipelines, stages, invites, customFields] = results.map((result) => result.data || []);
  renderAll();
}

function populateFormSelects() {
  const customerOptions = customers.filter((row) => !row.archived_at).map((row) => ({ id: row.id, label: row.display_name }));
  fillSelect(el("workItemForm").elements.customer_id, customerOptions.map((row) => ({ id: row.id, display_name: row.label })), "id", (row) => row.display_name, "Без привязки к клиенту");
  fillSelect(el("dealForm").elements.customer_id, customerOptions.map((row) => ({ id: row.id, display_name: row.label })), "id", (row) => row.display_name, "Без привязки к клиенту");

  const activeMembers = members.filter((row) => row.is_active);
  const assignees = currentOrg && ["owner", "admin"].includes(currentOrg.role)
    ? activeMembers
    : activeMembers.filter((row) => row.user_id === currentUser.id);
  const assigneeSelects = [
    el("workItemForm").elements.assigned_to,
    el("taskForm").elements.assigned_to,
    el("dealForm").elements.assigned_to
  ];
  assigneeSelects.forEach((select) => fillSelect(select, assignees, "user_id", (row) => memberName(row.user_id), null));
  assigneeSelects.forEach((select) => {
    if (Array.from(select.options).some((option) => option.value === currentUser.id)) select.value = currentUser.id;
  });

  fillSelect(
    el("workItemForm").elements.status,
    WORK_STATUSES.map((pair) => ({ value: pair[0], label: pair[1] })),
    "value",
    (row) => row.label,
    null
  );
  fillSelect(el("taskForm").elements.work_item_id, workItems.filter((row) => !row.archived_at), "id", (row) => row.title, null);
  fillSelect(el("dealForm").elements.pipeline_id, pipelines, "id", (row) => row.name, null);
  const pipelineId = el("dealForm").elements.pipeline_id.value || (pipelines[0] && pipelines[0].id);
  fillDealStages(pipelineId);
  if (currentOrg) el("dealForm").elements.currency.value = currentOrg.default_currency || "UZS";
}

function fillDealStages(pipelineId) {
  const pipelineStages = stages.filter((row) => row.pipeline_id === pipelineId);
  fillSelect(el("dealForm").elements.stage_id, pipelineStages, "id", (row) => row.name, null);
}

function renderAll() {
  renderSummary();
  populateFormSelects();
  renderCustomFieldInputs("customer", el("customerCustomFields"));
  renderCustomFieldInputs("work_item", el("work_itemCustomFields"));
  renderCustomFieldInputs("deal", el("dealCustomFields"));
  renderLists();
}

function renderLists() {
  renderCustomers();
  renderWorkItems();
  renderActivities();
  renderTasks();
  renderDeals();
  renderMembers();
  renderInvites();
  renderCustomFields();
}

function renderSummary() {
  const target = el("summaryStats");
  if (!currentOrg) {
    target.textContent = "Выберите или создайте компанию, чтобы увидеть сводку.";
    return;
  }
  const activeCustomers = customers.filter((row) => !row.archived_at).length;
  const activeWork = workItems.filter((row) => !row.archived_at);
  const openWork = activeWork.filter((row) => !["completed", "cancelled"].includes(row.status)).length;
  const activeTasks = tasks.filter((row) => !row.archived_at);
  const openTasks = activeTasks.filter((row) => !["done", "cancelled"].includes(row.status)).length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = [...activeWork, ...activeTasks].filter((row) => row.due_at && String(row.due_at).slice(0, 10) < today && !["completed", "cancelled", "done"].includes(row.status)).length;
  const activeDeals = deals.filter((row) => !row.archived_at);
  const totals = {};
  activeDeals.forEach((deal) => {
    const currency = deal.currency || "UZS";
    totals[currency] = (totals[currency] || 0) + Number(deal.amount || 0);
  });
  const dealTotals = Object.keys(totals).length
    ? Object.entries(totals).map(([currency, amount]) => amount.toLocaleString() + " " + currency).join(", ")
    : "нет активных сделок";
  target.textContent = "Клиенты: " + activeCustomers +
    " · Открытые заявки: " + openWork +
    " · Незавершённые поручения: " + openTasks +
    " · Просроченные задачи: " + overdue +
    " · Сумма сделок: " + dealTotals;
}

function renderCustomers() {
  const visible = customers.filter((row) => (showArchived || !row.archived_at) && matchesSearch([row.display_name, row.company_name, row.phone, row.email, row.notes, row.custom_data]));
  renderTable("customerList", ["Клиент", "Компания", "Телефон", "Email", "Заметки", "Состояние", "Действия"], visible, (customer) => {
    const row = document.createElement("tr");
    makeCell(row, customer.display_name);
    makeCell(row, customer.company_name);
    makeCell(row, customer.phone);
    makeCell(row, customer.email);
    makeCell(row, customer.notes);
    const actions = document.createElement("td");
    actions.append(makeButton("Изменить", async () => {
      const display_name = window.prompt("Имя или название клиента", customer.display_name);
      if (display_name === null) return;
      if (!display_name.trim()) throw new Error("Имя клиента не может быть пустым.");
      const company_name = window.prompt("Компания клиента", customer.company_name || "");
      if (company_name === null) return;
      const phone = window.prompt("Телефон", customer.phone || "");
      if (phone === null) return;
      const email = window.prompt("Email", customer.email || "");
      if (email === null) return;
      const notes = window.prompt("Заметки", customer.notes || "");
      if (notes === null) return;
      const customDataText = window.prompt("Дополнительные поля JSON", JSON.stringify(customer.custom_data || {}, null, 2));
      if (customDataText === null) return;
      const custom_data = parseJsonObject(customDataText, "Дополнительные поля");
      const { error } = await db.from("customers").update({
        display_name: display_name.trim(), company_name: company_name.trim() || null,
        phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null, custom_data
      }).eq("organization_id", currentOrgId()).eq("id", customer.id);
      if (error) throw error;
      await loadOrgData();
      message("Данные клиента обновлены.");
    }));
    actions.append(makeButton(customer.archived_at ? "Восстановить" : "В архив", async () => {
      const action = customer.archived_at ? "восстановить" : "переместить в архив";
      if (!window.confirm("Вы уверены, что хотите " + action + " клиента «" + customer.display_name + "»?")) return;
      const { error } = await db.from("customers").update({ archived_at: customer.archived_at ? null : new Date().toISOString() }).eq("organization_id", currentOrgId()).eq("id", customer.id);
      if (error) throw error;
      await loadOrgData();
      message(customer.archived_at ? "Клиент восстановлен." : "Клиент перемещён в архив.");
    }));
    makeCell(row, customer.archived_at ? "В архиве" : "Активен");
    row.append(actions);
    return row;
  });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
}

async function uploadWorkItemAttachment(item, fileInput) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) throw new Error("Сначала выберите файл.");
  if (file.size < 1) throw new Error("Пустые файлы прикреплять нельзя.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Максимальный размер файла — 20 МБ.");
  const safeName = file.name.normalize("NFKD").replace(/[^A-Za-z0-9._-]/g, "_").slice(-100) || "file";
  const storagePath = currentOrgId() + "/" + item.id + "/" + crypto.randomUUID() + "-" + safeName;
  const { error: uploadError } = await client.storage.from("crm-files").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (uploadError) throw uploadError;
  const { error: metadataError } = await db.from("attachments").insert({
    organization_id: currentOrgId(),
    work_item_id: item.id,
    storage_path: storagePath,
    original_filename: file.name.slice(0, 255),
    content_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: currentUser.id
  });
  if (metadataError) {
    await client.storage.from("crm-files").remove([storagePath]);
    throw metadataError;
  }
  fileInput.value = "";
  await loadOrgData();
  message("Файл прикреплён к заявке.");
}

function renderWorkItems() {
  const visible = workItems.filter((row) => (showArchived || !row.archived_at) && matchesSearch([row.title, row.description, row.status, row.priority, memberName(row.assigned_to), customerName(row.customer_id), row.custom_data]));
  renderTable("workItemList", ["Заявка", "Клиент", "Статус", "Приоритет", "Ответственный", "Срок", "Действие"], visible, (item) => {
    const row = document.createElement("tr");
    makeCell(row, item.title);
    makeCell(row, customerName(item.customer_id));
    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    WORK_STATUSES.forEach(([value, label]) => addOption(statusSelect, value, label));
    statusSelect.value = item.status;
    statusCell.append(statusSelect);
    row.append(statusCell);
    makeCell(row, item.priority);
    makeCell(row, memberName(item.assigned_to));
    makeCell(row, item.due_at ? String(item.due_at).slice(0, 10) : "");
    const actionCell = document.createElement("td");
    actionCell.append(makeButton("Изменить", async () => {
      const title = window.prompt("Название заявки", item.title);
      if (title === null) return;
      if (!title.trim()) throw new Error("Название заявки не может быть пустым.");
      const description = window.prompt("Описание", item.description || "");
      if (description === null) return;
      const priorityText = window.prompt("Приоритет от 1 до 5", String(item.priority));
      if (priorityText === null) return;
      const priority = Number(priorityText);
      if (!Number.isInteger(priority) || priority < 1 || priority > 5) throw new Error("Приоритет должен быть целым числом от 1 до 5.");
      const due = window.prompt("Срок (ГГГГ-ММ-ДД), пусто — без срока", item.due_at ? String(item.due_at).slice(0, 10) : "");
      if (due === null) return;
      const customDataText = window.prompt("Дополнительные поля JSON", JSON.stringify(item.custom_data || {}, null, 2));
      if (customDataText === null) return;
      const custom_data = parseJsonObject(customDataText, "Дополнительные поля");
      const { error } = await db.from("work_items").update({ title: title.trim(), description: description.trim() || null, priority, due_at: due.trim() || null, custom_data }).eq("organization_id", currentOrgId()).eq("id", item.id);
      if (error) throw error;
      await loadOrgData();
      message("Заявка обновлена.");
    }));
    actionCell.append(makeButton(item.archived_at ? "Восстановить" : "В архив", async () => {
      if (!window.confirm(item.archived_at ? "Восстановить заявку?" : "Переместить заявку в архив?")) return;
      const { error } = await db.from("work_items").update({ archived_at: item.archived_at ? null : new Date().toISOString() }).eq("organization_id", currentOrgId()).eq("id", item.id);
      if (error) throw error;
      await loadOrgData();
      message(item.archived_at ? "Заявка восстановлена." : "Заявка перемещена в архив.");
    }));
    actionCell.append(makeButton("Сохранить статус", async () => {
      const { error } = await db.from("work_items").update({ status: statusSelect.value }).eq("organization_id", currentOrgId()).eq("id", item.id);
      if (error) throw error;
      const log = await db.from("activity_log").insert({
        organization_id: currentOrgId(), work_item_id: item.id, actor_id: currentUser.id,
        activity_type: "status_changed", details: { status: statusSelect.value }
      });
      await loadOrgData();
      message(log.error ? "Статус обновлён; запись истории не сохранилась: " + log.error.message : "Статус заявки обновлён.");
    }));

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.setAttribute("aria-label", "Файл для заявки " + item.title);
    actionCell.append(fileInput);
    actionCell.append(makeButton("Загрузить файл", async () => uploadWorkItemAttachment(item, fileInput)));

    const itemAttachments = attachments.filter((attachment) => attachment.work_item_id === item.id);
    if (itemAttachments.length) {
      const filesBox = document.createElement("div");
      const filesTitle = document.createElement("p");
      filesTitle.textContent = "Файлы (" + itemAttachments.length + ")";
      filesBox.append(filesTitle);
      itemAttachments.forEach((attachment) => {
        const fileRow = document.createElement("p");
        fileRow.append(makeButton("Открыть: " + attachment.original_filename, async () => {
          const popup = window.open("about:blank", "_blank");
          if (!popup) throw new Error("Разрешите открытие новой вкладки для скачивания файла.");
          const { data, error } = await client.storage.from("crm-files").createSignedUrl(attachment.storage_path, 60);
          if (error) {
            popup.close();
            throw error;
          }
          popup.location.href = data.signedUrl;
        }));
        const size = document.createElement("span");
        size.textContent = " (" + formatBytes(attachment.size_bytes) + ")";
        fileRow.append(size);
        if (attachment.uploaded_by === currentUser.id || (currentOrg && ["owner", "admin"].includes(currentOrg.role))) {
          fileRow.append(makeButton("Удалить файл", async () => {
            if (!window.confirm("Удалить файл «" + attachment.original_filename + "»?")) return;
            const { error: storageError } = await client.storage.from("crm-files").remove([attachment.storage_path]);
            if (storageError) throw storageError;
            const { error: metadataError } = await db.from("attachments").delete().eq("organization_id", currentOrgId()).eq("id", attachment.id);
            if (metadataError) throw new Error("Файл удалён, но запись вложения не обновилась: " + metadataError.message);
            await loadOrgData();
            message("Файл удалён.");
          }));
        }
        filesBox.append(fileRow);
      });
      actionCell.append(filesBox);
    }
    row.append(actionCell);
    return row;
  });
}

function renderActivities() {
  const rows = activities;
  renderTable("activityList", ["Дата", "Действие", "Заявка", "Кто"], rows, (activity) => {
    const row = document.createElement("tr");
    makeCell(row, activity.created_at ? new Date(activity.created_at).toLocaleString() : "");
    const details = activity.details && typeof activity.details === "object" ? activity.details : {};
    makeCell(row, activity.activity_type + (details.title ? ": " + details.title : "") + (details.status ? " — " + details.status : ""));
    const work = workItems.find((item) => item.id === activity.work_item_id);
    makeCell(row, work ? work.title : String(activity.work_item_id).slice(0, 8));
    makeCell(row, memberName(activity.actor_id));
    return row;
  });
}

function renderTasks() {
  const visible = tasks.filter((row) => (showArchived || !row.archived_at) && matchesSearch([row.title, row.description, row.status, row.priority, memberName(row.assigned_to), row.custom_data]));
  renderTable("taskList", ["Поручение", "Заявка", "Статус", "Приоритет", "Ответственный", "Срок", "Действие"], visible, (task) => {
    const row = document.createElement("tr");
    makeCell(row, task.title);
    const parent = workItems.find((item) => item.id === task.work_item_id);
    makeCell(row, parent ? parent.title : String(task.work_item_id).slice(0, 8));
    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    TASK_STATUSES.forEach(([value, label]) => addOption(statusSelect, value, label));
    statusSelect.value = task.status;
    statusCell.append(statusSelect);
    row.append(statusCell);
    makeCell(row, task.priority);
    makeCell(row, memberName(task.assigned_to));
    makeCell(row, task.due_at ? String(task.due_at).slice(0, 10) : "");
    const actionCell = document.createElement("td");
    actionCell.append(makeButton("Изменить", async () => {
      const title = window.prompt("Название поручения", task.title);
      if (title === null) return;
      if (!title.trim()) throw new Error("Название поручения не может быть пустым.");
      const description = window.prompt("Описание", task.description || "");
      if (description === null) return;
      const priorityText = window.prompt("Приоритет от 1 до 5", String(task.priority));
      if (priorityText === null) return;
      const priority = Number(priorityText);
      if (!Number.isInteger(priority) || priority < 1 || priority > 5) throw new Error("Приоритет должен быть целым числом от 1 до 5.");
      const due = window.prompt("Срок (ГГГГ-ММ-ДД), пусто — без срока", task.due_at ? String(task.due_at).slice(0, 10) : "");
      if (due === null) return;
      const customDataText = window.prompt("Дополнительные поля JSON", JSON.stringify(task.custom_data || {}, null, 2));
      if (customDataText === null) return;
      const custom_data = parseJsonObject(customDataText, "Дополнительные поля");
      const { error } = await db.from("tasks").update({ title: title.trim(), description: description.trim() || null, priority, due_at: due.trim() || null, custom_data }).eq("organization_id", currentOrgId()).eq("id", task.id);
      if (error) throw error;
      await loadOrgData();
      message("Поручение обновлено.");
    }));
    actionCell.append(makeButton(task.archived_at ? "Восстановить" : "В архив", async () => {
      if (!window.confirm(task.archived_at ? "Восстановить поручение?" : "Переместить поручение в архив?")) return;
      const { error } = await db.from("tasks").update({ archived_at: task.archived_at ? null : new Date().toISOString() }).eq("organization_id", currentOrgId()).eq("id", task.id);
      if (error) throw error;
      await loadOrgData();
      message(task.archived_at ? "Поручение восстановлено." : "Поручение перемещено в архив.");
    }));
    actionCell.append(makeButton("Сохранить", async () => {
      const updates = { status: statusSelect.value, completed_at: statusSelect.value === "done" ? new Date().toISOString() : null };
      const { error } = await db.from("tasks").update(updates).eq("organization_id", currentOrgId()).eq("id", task.id);
      if (error) throw error;
      await loadOrgData();
      message("Поручение обновлено.");
    }));
    row.append(actionCell);
    return row;
  });
}

function renderDeals() {
  const visible = deals.filter((row) => (showArchived || !row.archived_at) && matchesSearch([row.title, row.description, row.amount, row.currency, customerName(row.customer_id), stageName(row.stage_id), memberName(row.assigned_to), row.custom_data]));
  renderTable("dealList", ["Сделка", "Клиент", "Сумма", "Этап", "Ответственный", "Дата закрытия", "Действие"], visible, (deal) => {
    const row = document.createElement("tr");
    makeCell(row, deal.title);
    makeCell(row, customerName(deal.customer_id));
    makeCell(row, Number(deal.amount).toLocaleString() + " " + deal.currency);
    const stageCell = document.createElement("td");
    const stageSelect = document.createElement("select");
    stages.filter((stage) => stage.pipeline_id === deal.pipeline_id).forEach((stage) => addOption(stageSelect, stage.id, stage.name));
    stageSelect.value = deal.stage_id;
    stageCell.append(stageSelect);
    row.append(stageCell);
    makeCell(row, memberName(deal.assigned_to));
    makeCell(row, deal.expected_close_date);
    const actionCell = document.createElement("td");
    actionCell.append(makeButton("Изменить", async () => {
      const title = window.prompt("Название сделки", deal.title);
      if (title === null) return;
      if (!title.trim()) throw new Error("Название сделки не может быть пустым.");
      const amountText = window.prompt("Сумма сделки", String(deal.amount));
      if (amountText === null) return;
      const amount = Number(amountText);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Сумма должна быть неотрицательным числом.");
      const currency = window.prompt("Валюта (ISO, например UZS)", deal.currency);
      if (currency === null) return;
      if (!/^[A-Za-z]{3}$/.test(currency.trim())) throw new Error("Укажите трёхбуквенный код валюты.");
      const expected = window.prompt("Ожидаемая дата закрытия (ГГГГ-ММ-ДД), пусто — без даты", deal.expected_close_date || "");
      if (expected === null) return;
      const description = window.prompt("Описание", deal.description || "");
      if (description === null) return;
      const customDataText = window.prompt("Дополнительные поля JSON", JSON.stringify(deal.custom_data || {}, null, 2));
      if (customDataText === null) return;
      const custom_data = parseJsonObject(customDataText, "Дополнительные поля");
      const { error } = await db.from("deals").update({ title: title.trim(), amount, currency: currency.trim().toUpperCase(), expected_close_date: expected.trim() || null, description: description.trim() || null, custom_data }).eq("organization_id", currentOrgId()).eq("id", deal.id);
      if (error) throw error;
      await loadOrgData();
      message("Сделка обновлена.");
    }));
    actionCell.append(makeButton(deal.archived_at ? "Восстановить" : "В архив", async () => {
      if (!window.confirm(deal.archived_at ? "Восстановить сделку?" : "Переместить сделку в архив?")) return;
      const { error } = await db.from("deals").update({ archived_at: deal.archived_at ? null : new Date().toISOString() }).eq("organization_id", currentOrgId()).eq("id", deal.id);
      if (error) throw error;
      await loadOrgData();
      message(deal.archived_at ? "Сделка восстановлена." : "Сделка перемещена в архив.");
    }));
    actionCell.append(makeButton("Сохранить этап", async () => {
      const { error } = await db.from("deals").update({ stage_id: stageSelect.value }).eq("organization_id", currentOrgId()).eq("id", deal.id);
      if (error) throw error;
      await loadOrgData();
      message("Этап сделки обновлён.");
    }));
    row.append(actionCell);
    return row;
  });
}

function renderMembers() {
  renderTable("memberList", ["Сотрудник", "Контакт", "Роль", "Статус", "Действия"], members, (member) => {
    const row = document.createElement("tr");
    makeCell(row, member.display_name || member.email || member.phone || String(member.user_id).slice(0, 8));
    makeCell(row, [member.email, member.phone].filter(Boolean).join(" / "));
    makeCell(row, member.role);
    makeCell(row, member.is_active ? "Активен" : "Отключён");
    const actionCell = document.createElement("td");
    const canManage = currentOrg && ["owner", "admin"].includes(currentOrg.role);
    if (canManage && member.role !== "owner") {
      if (currentOrg.role === "owner") {
        actionCell.append(makeButton(member.role === "admin" ? "Сделать сотрудником" : "Назначить администратором", async () => {
          const nextRole = member.role === "admin" ? "member" : "admin";
          const { error } = await db.rpc("update_member_role", {
            p_organization_id: currentOrgId(), p_user_id: member.user_id, p_role: nextRole
          });
          if (error) throw error;
          await loadOrgData();
          message("Роль сотрудника обновлена.");
        }));
      }
      if (!(currentOrg.role === "admin" && (member.role === "admin" || member.user_id === currentUser.id))) {
        actionCell.append(makeButton(member.is_active ? "Отключить" : "Включить", async () => {
          const { error } = await db.rpc("set_member_active", {
            p_organization_id: currentOrgId(), p_user_id: member.user_id, p_is_active: !member.is_active
          });
          if (error) throw error;
          await loadOrgData();
          message("Доступ сотрудника обновлён.");
        }));
      }
    }
    row.append(actionCell);
    return row;
  });
}

function renderInvites() {
  const visibleInvites = invites;
  renderTable("inviteList", ["Приглашённый", "Роль", "Создано", "Истекает", "Статус"], visibleInvites, (invite) => {
    const row = document.createElement("tr");
    makeCell(row, invite.invitee_email || invite.invitee_phone);
    makeCell(row, invite.role);
    makeCell(row, invite.created_at ? String(invite.created_at).slice(0, 10) : "");
    makeCell(row, invite.expires_at ? String(invite.expires_at).slice(0, 10) : "");
    makeCell(row, invite.accepted_at ? "Принято" : (new Date(invite.expires_at) < new Date() ? "Истекло" : "Ожидает"));
    return row;
  });
}

function renderCustomFieldInputs(entityType, target) {
  target.replaceChildren();
  const fields = customFields.filter((field) => field.entity_type === entityType && field.is_active);
  if (fields.length === 0) return;
  const heading = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Поля по сфере деятельности";
  heading.append(legend);
  for (const field of fields) {
    const label = document.createElement("label");
    label.textContent = field.label + (field.is_required ? " *" : "");
    let control;
    if (field.field_type === "boolean") {
      control = document.createElement("input");
      control.type = "checkbox";
    } else if (field.field_type === "select" || field.field_type === "multiselect") {
      control = document.createElement("select");
      if (field.field_type === "multiselect") control.multiple = true;
      if (field.field_type === "select") {
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = field.is_required ? "— Выберите вариант —" : "— Не выбрано —";
        emptyOption.selected = true;
        if (field.is_required) emptyOption.disabled = true;
        control.append(emptyOption);
      }
      const options = Array.isArray(field.options) ? field.options : [];
      options.forEach((option) => {
        if (typeof option === "string") addOption(control, option, option);
        else if (option && typeof option === "object" && option.value != null) addOption(control, option.value, option.label == null ? String(option.value) : String(option.label));
      });
    } else {
      control = document.createElement("input");
      control.type = field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : field.field_type === "url" ? "url" : "text";
      if (field.field_type === "number") control.step = "any";
    }
    control.dataset.customKey = field.field_key;
    control.dataset.customType = field.field_type;
    control.name = "custom_field_" + field.field_key;
    control.required = Boolean(field.is_required);
    label.append(control);
    heading.append(label);
  }
  target.append(heading);
}

function collectCustomData(entityType, rawJson, form) {
  const result = parseJsonObject(rawJson, "Дополнительные поля");
  const fields = customFields.filter((field) => field.entity_type === entityType && field.is_active);
  for (const field of fields) {
    const control = Array.from(form.querySelectorAll("[data-custom-key]")).find((node) => node.dataset.customKey === field.field_key);
    if (!control) continue;
    let value;
    if (field.field_type === "boolean") value = Boolean(control.checked);
    else if (field.field_type === "multiselect") value = Array.from(control.selectedOptions).map((option) => option.value).filter(Boolean);
    else if (field.field_type === "number") value = control.value === "" ? null : Number(control.value);
    else value = control.value.trim();
    if (field.is_required && (value === "" || value === null || (Array.isArray(value) && value.length === 0))) {
      throw new Error("Заполните обязательное поле: " + field.label);
    }
    if (value !== "" && value !== null && !(Array.isArray(value) && value.length === 0)) result[field.field_key] = value;
    else delete result[field.field_key];
  }
  return result;
}

function renderCustomFields() {
  renderTable("customFieldList", ["Сущность", "Поле", "Ключ", "Тип", "Статус"], customFields, (field) => {
    const row = document.createElement("tr");
    makeCell(row, field.entity_type);
    makeCell(row, field.label);
    makeCell(row, field.field_key);
    makeCell(row, field.field_type);
    makeCell(row, field.is_active ? "Активно" : "Отключено");
    return row;
  });
}

async function submitForm(form, handler) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      ensureClient();
      await handler(formObject(form), form);
    } catch (error) {
      message(error.message || String(error), true);
    } finally {
      if (button) button.disabled = false;
    }
  });
}

submitForm(el("emailLoginForm"), async (values) => {
  const { error } = await client.auth.signInWithOtp({
    email: values.email.trim(),
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) throw error;
  message("Ссылка для входа отправлена. В локальной среде откройте Mailpit: http://127.0.0.1:54324.");
});

submitForm(el("phoneLoginForm"), async (values) => {
  const { error } = await client.auth.signInWithOtp({ phone: values.phone.trim() });
  if (error) throw error;
  message("SMS-код отправлен. Введите его в поле подтверждения.");
});

submitForm(el("phoneVerifyForm"), async (values) => {
  const { error } = await client.auth.verifyOtp({
    phone: values.phone.trim(),
    token: values.token.trim(),
    type: "sms"
  });
  if (error) throw error;
  message("Телефон подтверждён. Выполняется вход…");
});

el("googleLoginButton").addEventListener("click", async () => {
  try {
    ensureClient();
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
  } catch (error) {
    message(error.message || String(error), true);
  }
});

el("showArchivedToggle").addEventListener("change", (event) => {
  showArchived = event.target.checked;
  renderLists();
});

el("globalSearch").addEventListener("input", (event) => {
  searchText = event.target.value.trim().toLocaleLowerCase();
  renderLists();
});

el("exportCustomers").addEventListener("click", () => exportCsv("clients.csv", [
  { key: "display_name", label: "Имя" }, { key: "company_name", label: "Компания" },
  { key: "phone", label: "Телефон" }, { key: "email", label: "Email" },
  { key: "notes", label: "Заметки" }, { key: "custom_data", label: "Дополнительные поля" },
  { key: "created_at", label: "Создан" }, { key: "archived_at", label: "Архивирован" }
], customers.filter((row) => (showArchived || !row.archived_at) && matchesSearch([row.display_name, row.company_name, row.phone, row.email, row.notes, row.custom_data]))));

el("exportWorkItems").addEventListener("click", () => exportCsv("requests.csv", [
  { key: "title", label: "Заявка" }, { key: "description", label: "Описание" },
  { key: "status", label: "Статус" }, { key: "priority", label: "Приоритет" },
  { key: "assigned_to", label: "Ответственный ID" }, { key: "due_at", label: "Срок" },
  { key: "customer_id", label: "Клиент ID" }, { key: "custom_data", label: "Дополнительные поля" },
  { key: "created_at", label: "Создана" }, { key: "archived_at", label: "Архивирована" }
], workItems.filter((row) => (showArchived || !row.archived_at) && matchesSearch([row.title, row.description, row.status, row.priority, memberName(row.assigned_to), customerName(row.customer_id), row.custom_data]))));

el("exportTasks").addEventListener("click", () => exportCsv("tasks.csv", [
  { key: "title", label: "Поручение" }, { key: "description", label: "Описание" },
  { key: "status", label: "Статус" }, { key: "priority", label: "Приоритет" },
  { key: "assigned_to", label: "Ответственный ID" }, { key: "due_at", label: "Срок" },
  { key: "work_item_id", label: "Заявка ID" }, { key: "custom_data", label: "Дополнительные поля" },
  { key: "created_at", label: "Создано" }, { key: "archived_at", label: "Архивировано" }
], tasks.filter((row) => (showArchived || !row.archived_at) && matchesSearch([row.title, row.description, row.status, row.priority, memberName(row.assigned_to), row.custom_data]))));

el("exportDeals").addEventListener("click", () => exportCsv("deals.csv", [
  { key: "title", label: "Сделка" }, { key: "description", label: "Описание" },
  { key: "amount", label: "Сумма" }, { key: "currency", label: "Валюта" },
  { key: "stage_id", label: "Этап ID" }, { key: "assigned_to", label: "Ответственный ID" },
  { key: "expected_close_date", label: "Ожидаемая дата" }, { key: "customer_id", label: "Клиент ID" },
  { key: "custom_data", label: "Дополнительные поля" }, { key: "created_at", label: "Создана" },
  { key: "archived_at", label: "Архивирована" }
], deals.filter((row) => (showArchived || !row.archived_at) && matchesSearch([row.title, row.description, row.amount, row.currency, customerName(row.customer_id), stageName(row.stage_id), memberName(row.assigned_to), row.custom_data]))));

el("signOutButton").addEventListener("click", async () => {
  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    message("Вы вышли из системы.");
  } catch (error) {
    message(error.message || String(error), true);
  }
});

submitForm(el("createOrgForm"), async (values) => {
  const { data, error } = await db.rpc("create_organization", {
    p_name: values.name.trim(),
    p_slug: values.slug.trim(),
    p_industry_code: values.industry_code
  });
  if (error) throw error;
  await loadOrganizations(data);
  message("Компания создана. Основная воронка и этапы созданы автоматически.");
});

el("organizationSelect").addEventListener("change", async (event) => {
  currentOrg = organizations.find((org) => org.organization_id === event.target.value) || null;
  fillOrgSettingsForm();
  if (currentOrg) {
    el("organizationInfo").textContent =
      "Сфера: " + currentOrg.industry_code +
      "; валюта: " + currentOrg.default_currency +
      "; язык: " + currentOrg.locale +
      "; часовой пояс: " + currentOrg.timezone;
  }
  try {
    await loadOrgData();
    message(currentOrg ? "Рабочая область загружена." : "Выберите или создайте компанию.");
  } catch (error) {
    message(error.message || String(error), true);
  }
});

submitForm(el("orgSettingsForm"), async (values) => {
  const { error } = await db.from("organizations").update({
    default_currency: values.default_currency.trim().toUpperCase(),
    locale: values.locale,
    timezone: values.timezone.trim(),
    settings: parseJsonObject(values.settings, "Настройки компании")
  }).eq("id", currentOrgId());
  if (error) throw error;
  const selectedId = currentOrgId();
  await loadOrganizations(selectedId);
  message("Настройки компании сохранены.");
});

submitForm(el("customerForm"), async (values, form) => {
  const { error } = await db.from("customers").insert({
    organization_id: currentOrgId(),
    display_name: values.display_name.trim(),
    company_name: values.company_name.trim() || null,
    phone: values.phone.trim() || null,
    email: values.email.trim() || null,
    notes: values.notes.trim() || null,
    custom_data: collectCustomData("customer", values.custom_data, form),
    created_by: currentUser.id
  });
  if (error) throw error;
  form.reset();
  form.elements.custom_data.value = "{}";
  await loadOrgData();
  message("Клиент сохранён.");
});

submitForm(el("workItemForm"), async (values, form) => {
  const { data, error } = await db.from("work_items").insert({
    organization_id: currentOrgId(),
    customer_id: values.customer_id || null,
    title: values.title.trim(),
    description: values.description.trim() || null,
    status: values.status,
    priority: Number(values.priority),
    assigned_to: values.assigned_to || currentUser.id,
    due_at: values.due_at || null,
    custom_data: collectCustomData("work_item", values.custom_data, form),
    created_by: currentUser.id
  }).select("id,title,status").single();
  if (error) throw error;
  const log = await db.from("activity_log").insert({
    organization_id: currentOrgId(), work_item_id: data.id, actor_id: currentUser.id,
    activity_type: "created", details: { title: data.title, status: data.status }
  });
  form.reset();
  form.elements.custom_data.value = "{}";
  await loadOrgData();
  message(log.error ? "Заявка создана, но запись истории не сохранилась: " + log.error.message : "Заявка создана.");
});

submitForm(el("taskForm"), async (values, form) => {
  const { error } = await db.from("tasks").insert({
    organization_id: currentOrgId(),
    work_item_id: values.work_item_id,
    title: values.title.trim(),
    description: values.description.trim() || null,
    priority: Number(values.priority),
    assigned_to: values.assigned_to || currentUser.id,
    due_at: values.due_at || null,
    custom_data: parseJsonObject(values.custom_data, "Дополнительные поля"),
    created_by: currentUser.id
  });
  if (error) throw error;
  form.reset();
  form.elements.custom_data.value = "{}";
  await loadOrgData();
  message("Поручение создано.");
});

submitForm(el("dealForm"), async (values, form) => {
  if (!values.pipeline_id || !values.stage_id) throw new Error("Сначала создайте компанию и загрузите воронку.");
  const { error } = await db.from("deals").insert({
    organization_id: currentOrgId(),
    pipeline_id: values.pipeline_id,
    stage_id: values.stage_id,
    customer_id: values.customer_id || null,
    title: values.title.trim(),
    amount: Number(values.amount),
    currency: values.currency.trim().toUpperCase(),
    expected_close_date: values.expected_close_date || null,
    assigned_to: values.assigned_to || currentUser.id,
    description: values.description.trim() || null,
    custom_data: collectCustomData("deal", values.custom_data, form),
    created_by: currentUser.id
  });
  if (error) throw error;
  form.reset();
  form.elements.custom_data.value = "{}";
  if (currentOrg) form.elements.currency.value = currentOrg.default_currency || "UZS";
  await loadOrgData();
  message("Сделка создана.");
});

el("dealForm").elements.pipeline_id.addEventListener("change", (event) => fillDealStages(event.target.value));

submitForm(el("inviteForm"), async (values, form) => {
  const email = values.invitee_email.trim() || null;
  const phone = values.invitee_phone.trim() || null;
  if (Boolean(email) === Boolean(phone)) throw new Error("Укажите ровно один контакт: email или телефон.");
  const { data, error } = await db.rpc("create_invite", {
    p_organization_id: currentOrgId(),
    p_invitee_email: email,
    p_invitee_phone: phone,
    p_role: values.role
  });
  if (error) throw error;
  const invite = Array.isArray(data) ? data[0] : data;
  const link = window.location.origin + window.location.pathname + "?invite=" + encodeURIComponent(invite.invite_token);
  const result = el("inviteResult");
  result.replaceChildren();
  const text = document.createElement("p");
  text.textContent = "Одноразовая ссылка (действует 7 дней): " + link;
  result.append(text);
  result.append(makeButton("Копировать ссылку", async () => {
    await navigator.clipboard.writeText(link);
    message("Ссылка скопирована.");
  }));
  form.reset();
  await loadOrgData();
  message("Приглашение создано. Передайте ссылку только указанному сотруднику.");
});

submitForm(el("customFieldForm"), async (values, form) => {
  const options = parseJsonArray(values.options, "Варианты");
  if (["select", "multiselect"].includes(values.field_type) && options.length === 0) {
    throw new Error("Для поля со списком добавьте хотя бы один вариант.");
  }
  const { error } = await db.from("custom_fields").insert({
    organization_id: currentOrgId(),
    entity_type: values.entity_type,
    field_key: values.field_key.trim(),
    label: values.label.trim(),
    field_type: values.field_type,
    options,
    is_required: new FormData(form).has("is_required"),
    is_active: true,
    created_by: currentUser.id
  });
  if (error) throw error;
  form.reset();
  form.elements.options.value = "[]";
  await loadOrgData();
  message("Дополнительное поле создано.");
});

async function boot() {
  if (!client) {
    setAppVisibility(false);
    message("Настройте crm-saas-local/app/config.js: укажите локальный Supabase URL и publishable key. Не используйте service-role key.", true);
    return;
  }
  const { data, error } = await client.auth.getSession();
  if (error) message(error.message, true);
  await refreshForSession(data ? data.session : null);
  client.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      refreshForSession(session).catch((error) => message(error.message || String(error), true));
    }, 0);
  });
}
boot().catch((error) => message(error.message || String(error), true));
