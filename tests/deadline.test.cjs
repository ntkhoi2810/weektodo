const assert = require("assert");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");

const filename = path.resolve(__dirname, "../src/helpers/deadline.js");
const compiled = babel.transformFileSync(filename, {
  babelrc: false,
  configFile: false,
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);
const { normalizeDeadline, deadlineMoment, groupTasksByDeadline } = loaded.exports;

const scheduled = { time: "16:20", alarm: true };
assert.strictEqual(normalizeDeadline(scheduled, "20260929"), true);
assert.strictEqual(scheduled.deadlineDate, "2026-09-29");
assert.strictEqual(scheduled.deadlineTime, "16:20");
assert.strictEqual(deadlineMoment(scheduled).format("YYYY-MM-DD HH:mm"), "2026-09-29 16:20");
assert.strictEqual(normalizeDeadline(scheduled, "20260930"), false);
assert.strictEqual(scheduled.deadlineDate, "2026-09-29", "schedule changes must not move a deadline");

const custom = { time: "09:15" };
normalizeDeadline(custom, "personal-list");
assert.strictEqual(custom.deadlineDate, null);
assert.strictEqual(custom.deadlineTime, "09:15");
assert.strictEqual(deadlineMoment(custom), null, "a time without a date cannot trigger a reminder");

const tasks = [
  { text: "none", deadlineDate: null, checked: false },
  { text: "later", deadlineDate: "2026-10-02", deadlineTime: "08:00", checked: false },
  { text: "done", deadlineDate: "2026-09-29", checked: true },
  { text: "earlier", deadlineDate: "2026-09-29", deadlineTime: "12:00", checked: false },
  { text: "first", deadlineDate: "2026-09-29", deadlineTime: "08:00", checked: false },
];
const grouped = groupTasksByDeadline(tasks);
assert.deepStrictEqual(grouped.groups.map(group => group.date), ["2026-09-29", "2026-10-02"]);
assert.deepStrictEqual(grouped.groups[0].tasks.map(entry => entry.task.text), ["first", "earlier"]);
assert.deepStrictEqual(grouped.noDeadline.map(entry => entry.index), [0]);
assert.deepStrictEqual(grouped.completed.map(entry => entry.index), [2]);

process.stdout.write("Deadline migration and grouping tests passed.\n");
