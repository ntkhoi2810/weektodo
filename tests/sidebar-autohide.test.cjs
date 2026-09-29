const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");
const { parse } = require("@vue/compiler-sfc");

const filename = path.resolve(__dirname, "../src/components/layout/WorkspaceMain.vue");
const script = parse(fs.readFileSync(filename, "utf8")).descriptor.script.content;
const compiled = babel.transformSync(script, {
  babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = loaded.require.bind(loaded);
const saved = [];
loaded.require = name => name.endsWith(".vue") || name === "./WorkspaceSidebar.vue" || name === "../toDoList.vue"
  ? {} : name === "../../repositories/configRepository"
    ? { update: config => saved.push({ ...config }) } : originalRequire(name);
loaded._compile(compiled, filename);
const component = loaded.exports.default;

const config = {};
const view = {
  config, isDesktop: true, sidebarOpen: true, hideTimer: null,
  $store: { commit(type, update) { assert.strictEqual(type, "updateConfig"); config[update.key] = update.val; } },
  $nextTick(callback) { callback(); },
  $refs: { sidebarToggle: { focus() { view.focusedHeader = true; } } },
  $el: { querySelector() { return { contains: target => target === "inside" }; } },
};
Object.defineProperty(view, "autoHideSidebar", { get: () => component.computed.autoHideSidebar.call(view) });
Object.assign(view, component.methods);
assert.strictEqual(view.autoHideSidebar, false, "old config defaults to pinned");
view.toggleAutoHide();
assert.strictEqual(view.autoHideSidebar, true);
assert.strictEqual(saved[0].autoHideSidebar, true);
assert.strictEqual(view.focusedHeader, true);
component.watch.autoHideSidebar.call(view, true);
assert.strictEqual(view.sidebarOpen, false);
view.openOnEdgeHover({ pointerType: "touch" });
assert.strictEqual(view.sidebarOpen, false);
view.openOnEdgeHover({ pointerType: "mouse" });
assert.strictEqual(view.sidebarOpen, true);

const originalTimeout = global.setTimeout;
const originalClear = global.clearTimeout;
const originalDocument = global.document;
let timer;
global.setTimeout = callback => { timer = callback; return 1; };
global.clearTimeout = () => {};
global.document = { activeElement: "inside" };
try {
  view.scheduleHide();
  timer();
  assert.strictEqual(view.sidebarOpen, true, "keyboard focus keeps overlay open");
  global.document.activeElement = "outside";
  view.scheduleHide();
  timer();
  assert.strictEqual(view.sidebarOpen, false);
  view.sidebarOpen = true;
  view.onKeyDown({ key: "Escape" });
  assert.strictEqual(view.sidebarOpen, false);
  assert.strictEqual(view.focusedHeader, true);
} finally {
  global.setTimeout = originalTimeout;
  global.clearTimeout = originalClear;
  global.document = originalDocument;
}
process.stdout.write("Sidebar auto-hide behavior tests passed.\n");
