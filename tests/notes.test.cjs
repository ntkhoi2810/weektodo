const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");
const { parse } = require("@vue/compiler-sfc");

const filename = path.resolve(__dirname, "../src/views/toDoModal/descriptionTextArea.vue");
const source = fs.readFileSync(filename, "utf8");
const script = parse(source).descriptor.script.content;
const compiled = babel.transformSync(script, {
  babelrc: false,
  configFile: false,
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);
const component = loaded.exports.default;

const updates = [];
const notes = {
  desc: "First line",
  original: "First line",
  editingDescription: true,
  $emit(event, value) { updates.push({ event, value }); },
};
Object.assign(notes, component.methods);
notes.desc = "First line\nSecond line";
notes.saveDescription();
notes.saveDescription(); // Losing focus after Ctrl+Enter must not save twice.
assert.deepStrictEqual(updates, [{ event: "updatedDescription", value: "First line\nSecond line" }]);
assert.strictEqual(notes.editingDescription, false);

notes.editingDescription = true;
notes.desc = "Discard this";
notes.cancelDescription();
assert.strictEqual(notes.desc, "First line\nSecond line");
assert.strictEqual(notes.editingDescription, false);
assert.strictEqual(updates.length, 1);

process.stdout.write("Notes save and cancel tests passed.\n");
