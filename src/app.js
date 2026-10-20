import { exportPayload, importPayload, normalizeRecord, sortRecords, status, toIcs, previewMerge, resolveMerge, persistRecords } from "./core.js";

const STORAGE_KEY = "warranty-expiration-file.v1";
const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element]));
let storedRaw = null;
let loadProblem = null;
let records = load();
let pendingMerge = null;
let importGeneration = 0;
let recordsVersion = 0;

function load() {
  try {
    storedRaw = localStorage.getItem(STORAGE_KEY);
    return importPayload(JSON.parse(storedRaw === null ? '{"schemaVersion":1,"records":[]}' : storedRaw));
  } catch (error) {
    loadProblem = error.message;
    return [];
  }
}

function renderRecovery() {
  elements["storage-recovery"].hidden = !loadProblem;
  elements["save-warranty"].disabled = Boolean(loadProblem);
  elements["export-json"].disabled = Boolean(loadProblem);
  elements["export-ics"].disabled = Boolean(loadProblem);
  elements["export-recovery"].disabled = storedRaw === null;
}

function commit(next, recovery = false) {
  if (loadProblem && !recovery) throw new Error("Saved data needs recovery. Review a valid backup before replacing it.");
  if (localStorage.getItem(STORAGE_KEY) !== storedRaw) throw new Error("Saved records changed in another tab. Reload before saving.");
  records = persistRecords({ setItem(key, value) { localStorage.setItem(key, value); storedRaw = value; } }, STORAGE_KEY, next);
  loadProblem = null;
  recordsVersion += 1;
  clearMerge();
  renderRecovery();
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
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
  elements.summary.textContent = loadProblem ? "Saved data could not be read; recovery is required." : `${records.length} total · ${counts.expiring} expiring soon · ${counts.expired} expired`;
  const selected = elements.filter.value;
  const visible = sortRecords(records).filter((record) => selected === "all" || status(record, today()) === selected);
  elements.records.replaceChildren(...visible.map(card));
  elements["empty-state"].hidden = visible.length > 0;
  elements["empty-state"].textContent = loadProblem ? "Existing data is unavailable. Use the recovery controls above." : "No warranties saved yet.";
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
elements["export-recovery"].addEventListener("click", () => { if (storedRaw !== null) download("warranties-recovery.json", storedRaw, "application/json"); });
elements["export-json"].addEventListener("click", () => download("warranties.json", `${JSON.stringify(exportPayload(records), null, 2)}\n`, "application/json"));
elements["export-ics"].addEventListener("click", () => download("warranty-expirations.ics", toIcs(records), "text/calendar"));
elements["import-json"].addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  // Capture the File before clearing the input; older reads must never clear a newer selection.
  event.target.value = "";
  const generation = ++importGeneration;
  clearMerge();
  try {
    const text = await file.text();
    if (generation !== importGeneration) return;
    // Read records only after the await, so intervening successful saves/deletes are included.
    showMerge(previewMerge(records, JSON.parse(text)));
  } catch (error) {
    if (generation === importGeneration) elements["import-message"].textContent = error.message;
  }
});

function clearMerge() {
  pendingMerge = null;
  elements["merge-preview"].hidden = true;
  elements["merge-conflicts"].replaceChildren();
}

function cancelMerge(announce = true) {
  importGeneration += 1;
  clearMerge();
  if (announce) {
    elements["import-message"].textContent = "Import canceled. Records unchanged.";
    elements["import-json"].focus();
  }
}

function showMerge(preview) {
  pendingMerge = { ...preview, recordsVersion };
  elements["recovery-confirmation"].hidden = !loadProblem;
  elements["confirm-recovery"].checked = false;
  elements["merge-apply"].textContent = loadProblem ? "Restore reviewed backup" : "Apply merge";
  elements["merge-summary"].textContent = preview.additions.length + " new · " +
    preview.unchanged.length + " unchanged · " + preview.conflicts.length +
    (loadProblem ? " conflicts. This reviewed backup will replace the unreadable saved data only after your confirmation." : " conflicts. Existing records absent from this backup are kept.");
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
  if (pendingMerge.recordsVersion !== recordsVersion) {
    cancelMerge(false);
    elements["import-message"].textContent = "Records changed. Import the backup again to review a fresh preview.";
    return;
  }
  try {
    const choices = Object.fromEntries(pendingMerge.conflicts.map((conflict, index) => [
      conflict.id, elements["merge-conflicts"].querySelector('input[name="merge-' + index + '"]:checked').value
    ]));
    const next = resolveMerge(pendingMerge, choices);
    if (loadProblem && !elements["confirm-recovery"].checked) throw new Error("Confirm that you saved or no longer need the unreadable data before restoring.");
    const recovering = Boolean(loadProblem);
    commit(next, recovering);
    resetForm();
    render();
    elements["import-message"].textContent = recovering ? "Reviewed backup restored locally." : "Backup merged. Existing records were retained.";
    elements["import-json"].focus();
  } catch (error) {
    elements["import-message"].textContent = "Import not applied: " + error.message;
  }
});

renderRecovery();
render();
