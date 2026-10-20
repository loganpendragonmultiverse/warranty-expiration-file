import assert from "node:assert/strict";
import test from "node:test";
import { addDays, exportPayload, importPayload, normalizeRecord, sortRecords, status, toIcs, validDate } from "../src/core.js";

const record = { id: "one", item: "Laptop", warrantyEnd: "2027-01-15", purchaseDate: "2026-01-15", category: "Tech", vendor: "Shop", model: "X", notes: "Receipt drawer" };

test("validDate rejects rollover dates", () => {
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("2028-02-29"), true);
});

test("normalization validates required fields and chronology", () => {
  assert.equal(normalizeRecord(record).item, "Laptop");
  assert.throws(() => normalizeRecord({ ...record, item: "" }), /requires/);
  assert.throws(() => normalizeRecord({ ...record, purchaseDate: "2028-01-01" }), /after/);
});

test("status uses inclusive warning boundary", () => {
  assert.equal(status({ ...record, warrantyEnd: "2026-01-01" }, "2026-01-02"), "expired");
  assert.equal(status({ ...record, warrantyEnd: "2026-03-03" }, "2026-01-02"), "expiring");
  assert.equal(status({ ...record, warrantyEnd: "2026-03-04" }, "2026-01-02"), "active");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("records sort by end date then item", () => {
  const sorted = sortRecords([{ ...record, id: "b", item: "Z", warrantyEnd: "2028-01-01" }, record]);
  assert.equal(sorted[0].id, "one");
});

test("payload round trip validates schema and duplicate ids", () => {
  const payload = exportPayload([record]);
  assert.deepEqual(importPayload(payload), [record]);
  assert.throws(() => importPayload({ schemaVersion: 2, records: [] }), /Unsupported/);
  assert.throws(() => importPayload({ schemaVersion: 1, records: [record, record] }), /duplicate/);
});

test("calendar output escapes text and uses exclusive end date", () => {
  const calendar = toIcs([{ ...record, item: "Laptop, work", notes: "Line 1\nLine 2" }]);
  assert.match(calendar, /SUMMARY:Warranty ends: Laptop\\, work/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20270115/);
  assert.match(calendar, /DTEND;VALUE=DATE:20270116/);
  assert.match(calendar, /Line 1\\nLine 2/);
});


test("backup fields require text rather than silently coercing data", () => {
  for (const value of [7, true, {}, [], null]) {
    for (const key of ["id", "item", "notes", "warrantyEnd"]) assert.throws(() => normalizeRecord({...record, [key]: value}), /must be text/);
  }
  assert.equal(validDate("0000-01-01"), false);
});

test("calendar text is escaped, UTF-8 folded and stamped", () => {
  const text = toIcs([{...record, notes: "é😀".repeat(100) + "\rEND:VEVENT\r\nBEGIN:VEVENT"}], new Date("2026-10-20T12:34:56Z"));
  assert.equal((text.replace(/\r\n /g, "").match(/BEGIN:VEVENT/g)||[]).length, 2); // One property value contains escaped text, never a content line.
  assert.equal(text.split("\r\n").filter(line => line === "BEGIN:VEVENT").length, 1);
  assert.ok(text.includes("DTSTAMP:20261020T123456Z"));
  assert.ok(text.replace(/\r\n /g, "").includes("\\nEND:VEVENT\\nBEGIN:VEVENT"));
  for (const line of text.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  assert.throws(() => toIcs([record], new Date(NaN)), /timestamp/);
});

test("last supported calendar day exports without an invalid five-digit end year", () => {
  const text = toIcs([{...record, warrantyEnd: "9999-12-31"}]);
  assert.ok(text.includes("DTSTART;VALUE=DATE:99991231"));
  assert.ok(!text.includes("DTEND"));
  assert.throws(() => toIcs([record, record]), /duplicate/);
});
