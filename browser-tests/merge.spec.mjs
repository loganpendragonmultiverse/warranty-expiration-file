import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const key = "warranty-expiration-file.v1";
const current = { id: "a", item: "Laptop", warrantyEnd: "2027-01-15" };
const other = { id: "other", item: "Retain me", warrantyEnd: "2028-01-01" };
const changed = { ...current, notes: "<script>plain text</script>" };
const added = { ...current, id: "new", item: "New item" };
const backup = records => ({ schemaVersion: 1, records });

async function open(page) {
  await page.route("http://localhost:4173/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const files = { "/": ["index.html", "text/html"], "/src/app.js": ["src/app.js", "text/javascript"],
      "/src/core.js": ["src/core.js", "text/javascript"], "/src/styles.css": ["src/styles.css", "text/css"] };
    const file = files[path];
    if (!file) return route.fulfill({ status: 404, body: "" });
    await route.fulfill({ body: await readFile(file[0]), contentType: file[1] });
  });
  await page.addInitScript(({ key, initial }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
  }, { key, initial: backup([current, other]) });
  await page.goto("http://localhost:4173/");
  await expect(page.locator("#summary")).toContainText("2 total");
}

async function upload(page, payload = backup([changed, added])) {
  await page.locator("#import-json").setInputFiles({
    name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)),
  });
}

async function stored(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)).records, key);
}

for (const width of [1280, 390]) {
  test("keyboard merge, cancel, retained records and exports at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    const before = await stored(page);
    await upload(page);
    await expect(page.locator("#merge-summary")).toContainText("1 new · 0 unchanged · 1 conflicts");
    await expect(page.getByRole("radio", { name: /^Keep current/ })).toBeChecked();
    await expect(page.locator("#merge-apply")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#merge-preview")).toBeHidden();
    expect(await stored(page)).toEqual(before);

    await upload(page);
    const incoming = page.getByRole("radio", { name: /^Use backup/ });
    await page.getByRole("radio", { name: /^Keep current/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(incoming).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#merge-apply").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#summary")).toContainText("3 total");
    expect((await stored(page)).find(record => record.id === "a").notes).toBe(changed.notes);
    expect((await stored(page)).find(record => record.id === "other").item).toBe("Retain me");
    await page.reload();
    await expect(page.locator("#summary")).toContainText("3 total");
    const downloading = page.waitForEvent("download");
    await page.locator("#export-ics").click();
    expect((await downloading).suggestedFilename()).toBe("warranty-expirations.ics");
  });
}

test("malformed import and storage failure leave records unchanged and preview retryable", async ({ page }) => {
  await open(page);
  const before = await stored(page);
  await upload(page);
  await upload(page, backup([current, current]));
  await expect(page.locator("#import-message")).toContainText("duplicate");
  await expect(page.locator("#merge-preview")).toBeHidden();
  expect(await stored(page)).toEqual(before);
  await upload(page);
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("Synthetic quota failure"); };
  });
  await page.locator("#merge-apply").click();
  await expect(page.locator("#import-message")).toContainText("Import not applied");
  await expect(page.locator("#merge-preview")).toBeVisible();
  await expect(page.locator("#summary")).toContainText("2 total");
  expect(await stored(page)).toEqual(before);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
  await page.locator("#merge-cancel").click();
  expect(await stored(page)).toEqual(before);
});

test("identical records and empty backup preserve all saved records", async ({ page }) => {
  await open(page);
  const before = await stored(page);
  await upload(page, backup([current, other]));
  await expect(page.locator("#merge-summary")).toContainText("0 new · 2 unchanged · 0 conflicts");
  await page.locator("#merge-apply").click();
  expect((await stored(page)).map(record => record.id)).toEqual(before.map(record => record.id));
  await upload(page, backup([]));
  await page.locator("#merge-apply").click();
  expect((await stored(page)).length).toBe(2);
});
