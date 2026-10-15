import assert from "node:assert/strict";
import test from "node:test";
import { previewMerge, resolveMerge, normalizeRecord, persistRecords, toIcs } from "../src/core.js";

const current = normalizeRecord({ id: "a", item: "Laptop", warrantyEnd: "2027-01-15" });
const other = normalizeRecord({ id: "other", item: "Keep me", warrantyEnd: "2028-01-01" });
const incoming = { ...current, notes: "Changed" };
const added = { ...current, id: "new", item: "New" };
const payload = records => ({ schemaVersion: 1, records });

test("preview classifies new, identical and conflicts without changing inputs", () => {
  const existing = [current, other];
  const backup = payload([incoming, other, added]);
  const before = JSON.stringify([existing, backup]);
  const preview = previewMerge(existing, backup);
  assert.deepEqual(preview.unchanged, ["other"]);
  assert.equal(preview.conflicts.length, 1);
  assert.equal(preview.additions.length, 1);
  assert.equal(JSON.stringify([existing, backup]), before);
  assert.deepEqual(resolveMerge(preview), [current, added, other]);
  assert.deepEqual(resolveMerge(preview, { a: "incoming" }), [incoming, added, other]);
  assert.throws(() => resolveMerge(preview, { a: "delete" }), /Unknown/);
});

test("duplicate IDs and malformed backups fail before preview", () => {
  for (const backup of [null, [], payload([current, current]), payload([null]), payload([{}])]) {
    assert.throws(() => previewMerge([current], backup));
  }
  assert.throws(() => previewMerge([current, current], payload([])), /duplicate/);
});

test("cancel discards preview; storage failure cannot change current data", () => {
  const existing = [current, other];
  const before = JSON.stringify(existing);
  let preview = previewMerge(existing, payload([incoming]));
  const next = resolveMerge(preview, { a: "incoming" });
  preview = null;
  assert.equal(preview, null);
  assert.equal(JSON.stringify(existing), before);
  assert.throws(() => persistRecords({ setItem() { throw new Error("Quota"); } }, "key", next), /Quota/);
  assert.equal(JSON.stringify(existing), before);
  let stored;
  assert.deepEqual(persistRecords({ setItem(key, value) { stored = JSON.parse(value); } },
    "key", next), next);
  assert.deepEqual(stored.records, next);
  assert.match(toIcs(next), /UID:other@warranty-expiration-file/);
  assert.match(toIcs(next), /DESCRIPTION:Changed/);
});
