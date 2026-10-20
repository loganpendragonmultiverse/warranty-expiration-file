import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const key = "warranty-expiration-file.v1";
const current = { id: "a", item: "Laptop", warrantyEnd: "2027-01-15" };
const other = { id: "other", item: "Retain me", warrantyEnd: "2028-01-01" };
const changed = { ...current, notes: "<script>plain text</script>" };
const added = { ...current, id: "new", item: "New item" };
const backup = records => ({ schemaVersion: 1, records });

async function open(page, expectedCount = 2) {
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
  if (expectedCount !== null) await expect(page.locator("#summary")).toContainText(expectedCount + " total");
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


async function deferReads(page) {
  await page.evaluate(() => {
    window.deferredReads = {};
    File.prototype.text = function () {
      return new Promise((resolve, reject) => {
        window.deferredReads[this.name] = { resolve, reject };
      });
    };
  });
}

async function beginDeferredImport(page, name) {
  await page.locator("#import-json").setInputFiles({
    name, mimeType: "application/json", buffer: Buffer.from("{}"),
  });
  await expect.poll(() => page.evaluate(name => Boolean(window.deferredReads[name]), name)).toBe(true);
}

async function finishDeferredImport(page, name, payload) {
  await page.evaluate(({ name, payload }) => {
    window.deferredReads[name].resolve(JSON.stringify(payload));
  }, { name, payload });
}

test("delayed import previews current records after a save, preserving the saved record on apply", async ({ page }) => {
  await open(page);
  await deferReads(page);
  await beginDeferredImport(page, "slow.json");
  await page.locator("#item").fill("Saved during import");
  await page.locator("#warranty-end").fill("2029-01-01");
  await page.getByRole("button", { name: "Save warranty", exact: true }).click();
  await expect(page.locator("#summary")).toContainText("3 total");
  await finishDeferredImport(page, "slow.json", backup([added]));
  await expect(page.locator("#merge-preview")).toBeVisible();
  await page.locator("#merge-apply").click();
  expect((await stored(page)).map(record => record.item)).toContain("Saved during import");
  await expect(page.locator("#summary")).toContainText("4 total");
});

test("delayed import does not restore a record deleted while reading the backup", async ({ page }) => {
  await open(page);
  await deferReads(page);
  await beginDeferredImport(page, "slow.json");
  page.once("dialog", dialog => dialog.accept());
  await page.locator("article").filter({ has: page.getByRole("heading", { name: "Retain me", exact: true }) })
    .getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator("#summary")).toContainText("1 total");
  await finishDeferredImport(page, "slow.json", backup([added]));
  await expect(page.locator("#merge-preview")).toBeVisible();
  await page.locator("#merge-apply").click();
  expect((await stored(page)).some(record => record.id === "other")).toBe(false);
  await expect(page.locator("#summary")).toContainText("2 total");
});

test("older import finishing after a newer import was canceled cannot reopen a preview", async ({ page }) => {
  await open(page);
  const before = await stored(page);
  await deferReads(page);
  await beginDeferredImport(page, "A.json");
  await beginDeferredImport(page, "B.json");
  await finishDeferredImport(page, "B.json", backup([added]));
  await expect(page.locator("#merge-preview")).toBeVisible();
  await page.locator("#merge-cancel").click();
  await expect(page.locator("#merge-preview")).toBeHidden();
  await finishDeferredImport(page, "A.json", backup([changed]));
  // Flush the pending promise continuation before asserting that it had no UI effect.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  await expect(page.locator("#merge-preview")).toBeHidden();
  await expect(page.locator("#import-message")).toContainText("Import canceled");
  expect(await stored(page)).toEqual(before);
});

test("saving while a preview is open invalidates the preview instead of applying its old records", async ({ page }) => {
  await open(page);
  await upload(page);
  await expect(page.locator("#merge-preview")).toBeVisible();
  await page.locator("#item").fill("Saved after preview");
  await page.locator("#warranty-end").fill("2029-01-01");
  await page.getByRole("button", { name: "Save warranty", exact: true }).click();
  await expect(page.locator("#merge-preview")).toBeHidden();
  expect((await stored(page)).map(record => record.item)).toContain("Saved after preview");
});


test("unreadable saved data remains intact until explicit reviewed recovery", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const raw = '{"schemaVersion":1,"records":[{"item":"unfinished"}]}';
  await page.addInitScript(({key,raw}) => {if (!sessionStorage.seeded) {localStorage.setItem(key,raw);sessionStorage.seeded="yes";}}, {key,raw});
  await open(page, null);
  await expect(page.locator("#storage-recovery")).toBeVisible();
  await expect(page.locator("#save-warranty")).toBeDisabled();
  await expect(page.locator("#export-json")).toBeDisabled();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
  const downloading = page.waitForEvent("download");
  await page.locator("#export-recovery").click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe(raw);
  await upload(page,backup([current]));
  await page.locator("#merge-apply").click();
  await expect(page.locator("#import-message")).toContainText("Confirm");
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
  await page.locator("#confirm-recovery").check();
  await page.locator("#merge-apply").click();
  await expect(page.locator("#storage-recovery")).toBeHidden();
  await expect(page.locator("#summary")).toContainText("1 total");
  expect((await stored(page))[0].item).toBe("Laptop");
  await page.reload();
  await expect(page.locator("#summary")).toContainText("1 total");
});

test("concurrent tab changes prevent overwriting newer saved data", async ({page}) => {
  await open(page);
  const newer=backup([{...current, notes:"Newer tab"}]);
  await page.evaluate(({key,newer})=>localStorage.setItem(key,JSON.stringify(newer)),{key,newer});
  await page.locator("#item").fill("Stale tab draft");
  await page.locator("#warranty-end").fill("2029-01-01");
  await page.getByRole("button",{name:"Save warranty",exact:true}).click();
  await expect(page.locator("#form-message")).toContainText("another tab");
  expect(await stored(page)).toEqual(newer.records);
  await expect(page.locator("#item")).toHaveValue("Stale tab draft");
});


test("built offline entry initializes, saves and exports without module requests", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const errors=[], requests=[];
  page.on("pageerror",error=>errors.push(String(error)));
  page.on("request",request=>requests.push(request.url()));
  await page.goto(pathToFileURL(resolve("dist/site/index.html")).href);
  await expect(page.locator("#summary")).toContainText("0 total");
  await page.locator("#item").fill("Offline fixture");
  await page.locator("#warranty-end").fill("2029-01-01");
  await page.getByRole("button",{name:"Save warranty",exact:true}).click();
  await expect(page.locator("#summary")).toContainText("1 total");
  await page.reload();
  await expect(page.locator("#summary")).toContainText("1 total");
  const exporting=page.waitForEvent("download");
  await page.locator("#export-ics").click();
  expect((await exporting).suggestedFilename()).toBe("warranty-expirations.ics");
  expect(errors).toEqual([]);
  expect(requests.every(url=>url.startsWith("file:") && url.endsWith("index.html"))).toBe(true);
});
