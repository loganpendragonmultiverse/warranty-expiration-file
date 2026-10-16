import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/site/src", { recursive: true });
await cp("index.html", "dist/site/index.html");
for (const file of ["app.js", "core.js", "styles.css"]) await cp(`src/${file}`, `dist/site/src/${file}`);
for (const file of ["README.md", "CHANGELOG.md", "DEVELOPMENT.md", "TESTING.md", "LICENSE"]) await cp(file, "dist/site/" + file);
