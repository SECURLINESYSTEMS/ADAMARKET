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
let tasks = [];
let deals = [];
let pipelines = [];
let stages = [];
let invites = [];
let customFields = [];
let inviteAttemptInProgress = false;
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
    members = []; customers = []; workItems = []; activities = []; tasks = []; deals = [];
    pipelines = []; stages = []; invites = []; customFields = [];
    renderAll();
    return;
  }
  const results = await Promise.all([
    db.from("organization_members").select("user_id,role,is_active,display_name,email,phone,joined_at").eq("organization_id", orgId).order("joined_at", { ascending: true }),
    db.from("customers").select("id,display_name,phone,email,company_name,notes,custom_data,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("work_items").select("id,customer_id,title,description,status,priority,assigned_to,due_at,custom_data,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("activity_log").select("id,work_item_id,actor_id,activity_type,details,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("tasks").select("id,work_item_id,title,description,status,priority,assigned_to,due_at,completed_at,custom_data,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("deals").select("id,pipeline_id,stage_id,customer_id,title,amount,currency,expected_close_date,assigned_to,description,custom_data,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("pipelines").select("id,name,is_default").eq("organization_id", orgId).order("created_at", { ascending: true }),
    db.from("pipeline_stages").select("id,pipeline_id,name,position,probability,is_won,is_lost").eq("organization_id", orgId).order("position", { ascending: true }),
    db.from("organization_invites").select("id,invitee_email,invitee_phone,role,expires_at,accepted_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("custom_fields").select("id,entity_type,field_key,label,field_type,options,is_required,is_active").eq("organization_id", orgId).order("created_at", { ascending: true })
  ]);
  const firstError = results.find((result) => result.error);
  if (firstError) throw firstError.error;
  [members, customers, workItems, activities, tasks, deals, pipelines, stages, invites, customFields] = results.map((result) => result.data || []);
  renderAll();
}

function populateFormSelects() {
  const customerOptions = customers.map((row) => ({ id: row.id, label: row.display_name }));
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
  fillSelect(el("taskForm").elements.work_item_id, workItems, "id", (row) => row.title, null);
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
  populateFormSelects();
  renderCustomers();
  renderWorkItems();
  renderActivities();
  renderTasks();
  renderDeals();
  renderMembers();
  renderInvites();
  renderCustomFields();
}

function renderCustomers() {
  renderTable("customerList", ["Клиент", "Компания", "Телефон", "Email", "Заметки"], customers, (customer) => {
    const row = document.createElement("tr");
    makeCell(row, customer.display_name);
    makeCell(row, customer.company_name);
    makeCell(row, customer.phone);
    makeCell(row, customer.email);
    makeCell(row, customer.notes);
    return row;
  });
}

function renderWorkItems() {
  renderTable("workItemList", ["Заявка", "Клиент", "Статус", "Приоритет", "Ответственный", "Срок", "Действие"], workItems, (item) => {
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
  renderTable("taskList", ["Поручение", "Заявка", "Статус", "Приоритет", "Ответственный", "Срок", "Действие"], tasks, (task) => {
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
  renderTable("dealList", ["Сделка", "Клиент", "Сумма", "Этап", "Ответственный", "Дата закрытия", "Действие"], deals, (deal) => {
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
    custom_data: parseJsonObject(values.custom_data, "Дополнительные поля"),
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
    custom_data: parseJsonObject(values.custom_data, "Дополнительные поля"),
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
    custom_data: parseJsonObject(values.custom_data, "Дополнительные поля"),
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
  const { error } = await db.from("custom_fields").insert({
    organization_id: currentOrgId(),
    entity_type: values.entity_type,
    field_key: values.field_key.trim(),
    label: values.label.trim(),
    field_type: values.field_type,
    options: parseJsonArray(values.options, "Варианты"),
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
