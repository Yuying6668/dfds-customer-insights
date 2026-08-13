import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../app/App.jsx", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../app/styles.css", import.meta.url), "utf8");

test("provides an accessible sidebar collapse control and exposes its state to the app shell", () => {
  assert.match(appSource, /const \[isSidebarCollapsed, setIsSidebarCollapsed\] = useState\(false\)/);
  assert.match(appSource, /className={`shell\$\{isSidebarCollapsed \? " sidebar-collapsed" : ""\}`}/);
  assert.match(appSource, /className="sidebar-toggle"/);
  assert.match(appSource, /aria-expanded={!isSidebarCollapsed}/);
  assert.match(appSource, /aria-label={isSidebarCollapsed \? "Expand navigation" : "Collapse navigation"}/);
  assert.match(stylesSource, /\.shell\.sidebar-collapsed/);
  assert.match(stylesSource, /\.sidebar-collapsed \.sidebar/);
  assert.match(stylesSource, /@media \(max-width: 980px\) \{[\s\S]*?\.shell\.sidebar-collapsed/);
  assert.match(stylesSource, /\.nav-group-label[\s\S]*?font-size: 0\.72rem/);
  assert.match(stylesSource, /\.nav-group-label[\s\S]*?letter-spacing: 0\.12em/);
  assert.match(stylesSource, /\.nav-item[\s\S]*?font-size: 0\.96rem/);
  assert.match(stylesSource, /\.nav-item[\s\S]*?font-weight: 500/);
});
