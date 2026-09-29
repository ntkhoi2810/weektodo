const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");
const { parse } = require("@vue/compiler-sfc");

const filename = path.resolve(__dirname, "../src/views/toDoModal/timePicker.vue");
const script = parse(fs.readFileSync(filename, "utf8")).descriptor.script.content;
const compiled = babel.transformSync(script, {
  babelrc: false,
  configFile: false,
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);
const picker = loaded.exports.default;

const selections = [];
const instance = {
  date: "2026-09-29",
  time: "09:15",
  isPm: false,
  selectedHour: 9,
  $emit(event, value) { selections.push({ event, value }); },
};
Object.assign(instance, picker.methods);
instance.setPeriod(true);
assert.deepStrictEqual(selections.pop().value, { date: "2026-09-29", time: "21:15" });
instance.time = "21:15";
instance.chooseMinute("30");
assert.deepStrictEqual(selections.pop().value, { date: "2026-09-29", time: "21:30" });
instance.setDate(null);
assert.deepStrictEqual(selections.pop().value, { date: null, time: "21:15" });
instance.setTime(null);
assert.deepStrictEqual(selections.pop().value, { date: "2026-09-29", time: null });

process.stdout.write("Clock and deadline selection tests passed.\n");
