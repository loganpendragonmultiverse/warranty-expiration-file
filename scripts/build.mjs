import { readFile, cp, mkdir, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const out = new URL("dist/site/", root);
await rm(out, {recursive:true, force:true});
await mkdir(new URL("src/", out), {recursive:true});
const scripts = ["core.js", "app.js"];
const parts = [];
for (const name of scripts) {
  const source = await readFile(new URL("src/" + name, root), "utf8");
  const bundled = source.replace(/^import\s+\{[^}]*\}\s+from\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^export\s+(?=(?:async\s+)?function|const|let|class)/gm, "");
  if (/^(?:import|export)\s/m.test(bundled) || /<\/script/i.test(bundled)) throw new Error("Unsupported inline script syntax in " + name);
  parts.push(bundled);
  await cp(new URL("src/" + name, root), new URL("src/" + name, out));
}
const css = await readFile(new URL("src/styles.css", root), "utf8");
if (/<\/style/i.test(css)) throw new Error("Unsupported inline stylesheet syntax");
const html = (await readFile(new URL("index.html", root), "utf8"))
  .replace(/<link rel="stylesheet" href="src\/styles.css">/, () => "<style>\n" + css + "\n</style>")
  .replace(/<script type="module" src="src\/app.js"><\/script>/, () => '<script type="module">\n' + parts.join("\n") + "\n</script>");
if (/<script[^>]+src=|<link[^>]+rel="stylesheet"/i.test(html)) throw new Error("Offline entry point still references external app resources");
await writeFile(new URL("index.html", out), html);
await cp(new URL("src/styles.css", root), new URL("src/styles.css", out));
for (const name of ["README.md","DEVELOPMENT.md","TESTING.md","CHANGELOG.md","LICENSE"]) await cp(new URL(name, root), new URL(name, out));
console.log(out.pathname);
