const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Each record must be an object.");
  const record = {};
  for (const key of ["id", "item", "warrantyEnd", "purchaseDate", "category", "vendor", "model", "notes"]) {
    const value = input[key];
    if (value !== undefined && typeof value !== "string") throw new Error(key + " must be text.");
    record[key] = (value ?? "").trim();
  }
  if (!record.id || !record.item) throw new Error("Each record requires an id and item name.");
  if (!validDate(record.warrantyEnd)) throw new Error("Warranty end must be a real YYYY-MM-DD date.");
  if (record.purchaseDate && !validDate(record.purchaseDate)) throw new Error("Purchase date must be a real YYYY-MM-DD date.");
  if (record.purchaseDate && record.purchaseDate > record.warrantyEnd) throw new Error("Purchase date cannot be after the warranty end.");
  return record;
}

export function addDays(date, days) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function status(record, today, warningDays = 60) {
  if (record.warrantyEnd < today) return "expired";
  return record.warrantyEnd <= addDays(today, warningDays) ? "expiring" : "active";
}

export function sortRecords(records) {
  return [...records].sort((left, right) => left.warrantyEnd.localeCompare(right.warrantyEnd) || left.item.localeCompare(right.item));
}

export function exportPayload(records) {
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), records: sortRecords(records).map(normalizeRecord) };
}

export function importPayload(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.records)) throw new Error("Unsupported warranty backup format.");
  const records = value.records.map(normalizeRecord);
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("Backup contains duplicate record ids.");
  return records;
}

function escapeIcs(value) {
  return value.replaceAll("\\", "\\\\").replace(/\r\n|\r|\n/g, "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function foldIcs(line) {
  const encoder = new TextEncoder();
  let folded = "", width = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (width + size > 75) { folded += "\r\n "; width = 1; }
    folded += character; width += size;
  }
  return folded;
}

export function toIcs(records, createdAt = new Date()) {
  if (!(createdAt instanceof Date) || !Number.isFinite(createdAt.getTime()) || createdAt.getUTCFullYear() < 1 || createdAt.getUTCFullYear() > 9999) throw new Error("Calendar requires a valid creation timestamp.");
  const normalized = importPayload({ schemaVersion: 1, records });
  const timestamp = createdAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const events = sortRecords(normalized).flatMap((record) => [
    "BEGIN:VEVENT",
    `UID:${escapeIcs(record.id)}@warranty-expiration-file`,
    `DTSTAMP:${timestamp}`,
    `DTSTART;VALUE=DATE:${record.warrantyEnd.replaceAll("-", "")}`,
    // An all-day DTSTART without DTEND has a one-day duration. Avoid a five-digit year.
    ...(record.warrantyEnd === "9999-12-31" ? [] : [`DTEND;VALUE=DATE:${addDays(record.warrantyEnd, 1).replaceAll("-", "")}`]),
    `SUMMARY:${escapeIcs(`Warranty ends: ${record.item}`)}`,
    `DESCRIPTION:${escapeIcs([record.vendor, record.model, record.notes].filter(Boolean).join(" · "))}`,
    "END:VEVENT",
  ]);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Logan Pendragon Multiverse//Warranty Expiration File//EN", ...events, "END:VCALENDAR", ""].map(foldIcs).join("\r\n");
}

// Pure preview: neither the current records nor backup is changed.
export function previewMerge(current, payload) {
  const incoming = importPayload(payload);
  const existing = importPayload({ schemaVersion: 1, records: current });
  const byId = new Map(existing.map(record => [record.id, record]));
  const additions = [], unchanged = [], conflicts = [];
  for (const record of incoming) {
    const saved = byId.get(record.id);
    if (!saved) additions.push(record);
    else if (JSON.stringify(saved) === JSON.stringify(record)) unchanged.push(record.id);
    else conflicts.push({ id: record.id, current: saved, incoming: record });
  }
  return { current: existing, additions, unchanged, conflicts };
}

export function resolveMerge(preview, choices = {}) {
  const byId = new Map(preview.current.map(record => [record.id, { ...record }]));
  for (const record of preview.additions) byId.set(record.id, { ...record });
  for (const conflict of preview.conflicts) {
    const choice = Object.hasOwn(choices, conflict.id) ? choices[conflict.id] : "keep";
    if (!["keep", "incoming"].includes(choice)) throw new Error("Unknown conflict choice.");
    if (choice === "incoming") byId.set(conflict.id, { ...conflict.incoming });
  }
  return sortRecords([...byId.values()]);
}

export function persistRecords(storage, key, records) {
  // Store first: quota/access errors must not commit visible in-memory changes.
  storage.setItem(key, JSON.stringify(exportPayload(records)));
  return records;
}
