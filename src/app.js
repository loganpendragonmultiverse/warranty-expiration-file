import { exportPayload, importPayload, normalizeRecord, sortRecords, status, toIcs } from "./core.js";

const STORAGE_KEY = "warranty-expiration-file.v1";
const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element]));
let records = load();

function load() {
  try {
    return importPayload(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"schemaVersion":1,"records":[]}'));
  } catch {
    const emptyRecords = [];
    return emptyRecords;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exportPayload(records)));
}

function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

function download(name, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formRecord() {
  return normalizeRecord({
    id: elements["record-id"].value || crypto.randomUUID(),
    item: elements.item.value,
    warrantyEnd: elements["warranty-end"].value,
    purchaseDate: elements["purchase-date"].value,
    category: elements.category.value,
    vendor: elements.vendor.value,
    model: elements.model.value,
    notes: elements.notes.value,
  });
}

function resetForm() {
  elements["warranty-form"].reset();
  elements["record-id"].value = "";
  elements["cancel-edit"].hidden = true;
}

function edit(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  for (const [key, field] of [["item", "item"], ["warrantyEnd", "warranty-end"], ["purchaseDate", "purchase-date"], ["category", "category"], ["vendor", "vendor"], ["model", "model"], ["notes", "notes"]]) elements[field].value = record[key];
  elements["record-id"].value = record.id;
  elements["cancel-edit"].hidden = false;
  elements.item.focus();
}

function remove(id) {
  const record = records.find((item) => item.id === id);
  if (!record || !confirm(`Delete the warranty record for “${record.item}”?`)) return;
  records = records.filter((item) => item.id !== id);
  save();
  render();
}

function card(record) {
  const state = status(record, today());
  const article = document.createElement("article");
  article.className = `record ${state}`;
  const heading = document.createElement("h3");
  heading.textContent = record.item;
  const meta = document.createElement("p");
  meta.textContent = `${state === "expired" ? "Expired" : state === "expiring" ? "Expires soon" : "Active"} · ${record.warrantyEnd}${record.vendor ? ` · ${record.vendor}` : ""}`;
  const details = document.createElement("p");
  details.textContent = [record.category, record.model, record.notes].filter(Boolean).join(" · ");
  const actions = document.createElement("div");
  actions.className = "actions";
  for (const [label, handler, className] of [["Edit", () => edit(record.id), "secondary"], ["Delete", () => remove(record.id), "danger"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = className;
    button.addEventListener("click", handler);
    actions.append(button);
  }
  article.append(heading, meta, details, actions);
  return article;
}

function render() {
  const counts = { active: 0, expiring: 0, expired: 0 };
  for (const record of records) counts[status(record, today())] += 1;
  elements.summary.textContent = `${records.length} total · ${counts.expiring} expiring soon · ${counts.expired} expired`;
  const selected = elements.filter.value;
  const visible = sortRecords(records).filter((record) => selected === "all" || status(record, today()) === selected);
  elements.records.replaceChildren(...visible.map(card));
  elements["empty-state"].hidden = visible.length > 0;
}

elements["warranty-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const record = formRecord();
    records = [...records.filter((item) => item.id !== record.id), record];
    save();
    resetForm();
    elements["form-message"].textContent = "Warranty saved locally.";
    render();
  } catch (error) {
    elements["form-message"].textContent = error.message;
  }
});
elements["cancel-edit"].addEventListener("click", resetForm);
elements.filter.addEventListener("change", render);
elements["export-json"].addEventListener("click", () => download("warranties.json", `${JSON.stringify(exportPayload(records), null, 2)}\n`, "application/json"));
elements["export-ics"].addEventListener("click", () => download("warranty-expirations.ics", toIcs(records), "text/calendar"));
elements["import-json"].addEventListener("change", async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    const imported = importPayload(JSON.parse(await file.text()));
    if (!confirm(`Replace current records with ${imported.length} imported record(s)?`)) return;
    records = imported;
    save();
    render();
    elements["import-message"].textContent = "Backup imported.";
  } catch (error) {
    elements["import-message"].textContent = error.message;
  } finally {
    event.target.value = "";
  }
});

render();
