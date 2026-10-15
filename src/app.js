import { exportPayload, importPayload, normalizeRecord, sortRecords, status, toIcs, previewMerge, resolveMerge, persistRecords } from "./core.js";

const STORAGE_KEY = "warranty-expiration-file.v1";
const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element]));
let records = load();
let pendingMerge = null;

function load() {
  try {
    return importPayload(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"schemaVersion":1,"records":[]}'));
  } catch {
    const emptyRecords = [];
    return emptyRecords;
  }
}

function commit(next) {
  records = persistRecords(localStorage, STORAGE_KEY, next);
  cancelMerge(false);
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
  try {
    commit(records.filter((item) => item.id !== id));
  } catch (error) {
    elements["form-message"].textContent = error.message;
    return;
  }
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
    commit([...records.filter((item) => item.id !== record.id), record]);
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
    cancelMerge(false);
    showMerge(previewMerge(records, JSON.parse(await file.text())));
  } catch (error) {
    elements["import-message"].textContent = error.message;
  } finally {
    event.target.value = "";
  }
});

function cancelMerge(announce = true) {
  pendingMerge = null;
  elements["merge-preview"].hidden = true;
  elements["merge-conflicts"].replaceChildren();
  if (announce) {
    elements["import-message"].textContent = "Import canceled. Records unchanged.";
    elements["import-json"].focus();
  }
}

function showMerge(preview) {
  pendingMerge = preview;
  elements["merge-summary"].textContent = preview.additions.length + " new · " +
    preview.unchanged.length + " unchanged · " + preview.conflicts.length +
    " conflicts. Existing records absent from this backup are kept.";
  elements["merge-conflicts"].replaceChildren();
  preview.conflicts.forEach((conflict, index) => {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "Conflict: " + conflict.current.item + " (" + conflict.id + ")";
    fieldset.append(legend);
    for (const [value, label, record] of [
      ["keep", "Keep current", conflict.current], ["incoming", "Use backup", conflict.incoming]]) {
      const wrapper = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio"; radio.name = "merge-" + index; radio.value = value;
      radio.checked = value === "keep";
      wrapper.append(radio, document.createTextNode(label));
      const details = document.createElement("p");
      details.textContent = Object.entries(record).filter(([key]) => key !== "id")
        .map(([key, value]) => key + ": " + value).join(" · ");
      wrapper.append(details);
      fieldset.append(wrapper);
    }
    elements["merge-conflicts"].append(fieldset);
  });
  elements["merge-preview"].hidden = false;
  elements["import-message"].textContent = "Review the preview, then apply or cancel.";
  elements["merge-apply"].focus();
}

elements["merge-cancel"].addEventListener("click", () => cancelMerge());
elements["merge-preview"].addEventListener("keydown", event => {
  if (event.key === "Escape") { event.preventDefault(); cancelMerge(); }
});
elements["merge-apply"].addEventListener("click", () => {
  if (!pendingMerge) return;
  try {
    const choices = Object.fromEntries(pendingMerge.conflicts.map((conflict, index) => [
      conflict.id, elements["merge-conflicts"].querySelector('input[name="merge-' + index + '"]:checked').value
    ]));
    const next = resolveMerge(pendingMerge, choices);
    commit(next);
    resetForm();
    render();
    elements["import-message"].textContent = "Backup merged. Existing records were retained.";
    elements["import-json"].focus();
  } catch (error) {
    elements["import-message"].textContent = "Import not applied: " + error.message;
  }
});

render();
