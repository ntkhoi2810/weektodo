const assert = require("assert");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");
const { RRule } = require("rrule");

function load(filename) {
  const compiled = babel.transformFileSync(filename, {
    babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const moduleInstance = new Module(filename, module);
  moduleInstance.filename = filename;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filename));
  moduleInstance._compile(compiled, filename);
  return moduleInstance.exports;
}

const { monthDays, monthDeadlineEntries } = load(path.resolve(__dirname, "../src/helpers/monthCalendar.js"));
const monday = monthDays("20260930", true);
assert.strictEqual(monday[0], "20260831");
assert.strictEqual(monday[monday.length - 1], "20261004");
assert.strictEqual(monday.length, 35);
assert.strictEqual(monthDays("20260201", false)[0], "20260201");
assert.strictEqual(monthDays("20260201", true).length, 35);
assert.strictEqual(monthDays("20260801", false).length, 42);

const rule = new RRule({ freq: RRule.WEEKLY, dtstart: new Date(Date.UTC(2026, 8, 1)), count: 5 });
const recurring = {
  repeat1: { id: "repeat1", repeating_rule: rule.toString(),
    data: { text: "Repeat", listId: "20260901", deadlineDate: "2026-09-02", deadlineTime: "10:00", checked: false } },
};
const lists = {
  "20260901": [
    { text: "No deadline", checked: false, deadlineDate: null },
    { text: "Later", checked: false, deadlineDate: "2026-09-10", deadlineTime: null },
    { text: "Done", checked: true, deadlineDate: "2026-09-10" },
    { text: "Repeat", checked: false, deadlineDate: "2026-09-02", deadlineTime: "10:00", repeatingEvent: "repeat1" },
  ],
  personal: [{ text: "Earlier", checked: false, deadlineDate: "2026-09-10", deadlineTime: "09:00" }],
};
const entries = monthDeadlineEntries(lists, recurring, { "20260901": { repeat1: true } }, monday);
assert.strictEqual(entries["2026-09-01"], undefined);
assert.deepStrictEqual(entries["2026-09-10"].map(entry => entry.task.text), ["Earlier", "Later"]);
assert.strictEqual(entries["2026-09-02"].length, 1, "stored occurrence must not be projected again");
assert.strictEqual(entries["2026-09-09"][0].virtual, true);
assert.strictEqual(entries["2026-09-09"][0].listId, "20260908");
assert.strictEqual(monthDeadlineEntries({}, {}, {}, monday)["2026-09-10"], undefined);
process.stdout.write("Month calendar grouping and recurrence tests passed.\n");
