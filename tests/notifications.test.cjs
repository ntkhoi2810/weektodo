const assert = require("assert");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");
const moment = require("moment");

function load(filename, overrides = {}) {
  const compiled = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => name in overrides ? overrides[name] : originalRequire(name);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const deadline = load(path.resolve(__dirname, "../src/helpers/deadline.js"));
const records = [
  ["unloaded-list", [{ text: "Due soon", checked: false, alarm: true, deadlineDate: "2026-09-29", deadlineTime: "09:30" }]],
  ["undated-list", [{ text: "No date", checked: false, alarm: true, deadlineDate: null, deadlineTime: "09:30" }]],
];
const dbRepository = {
  open() {
    const request = {};
    process.nextTick(() => request.onsuccess({ target: { result: { close() {} } } }));
    return request;
  },
  selectAll() {
    const request = {};
    let index = 0;
    const advance = () => {
      request.result = index < records.length
        ? { key: records[index][0], value: records[index++][1], continue: () => process.nextTick(advance) }
        : null;
      request.onsuccess();
    };
    process.nextTick(advance);
    return request;
  },
};

const fixedMoment = (...args) => args.length ? moment(...args) : moment("2026-09-29 09:00", "YYYY-MM-DD HH:mm");
Object.assign(fixedMoment, moment);
const notifications = load(path.resolve(__dirname, "../src/helpers/notifications.js"), {
  moment: fixedMoment,
  "../repositories/dbRepository": dbRepository,
  "./deadline": deadline,
}).default;

const store = {
  getters: { notifications: [], todoLists: {}, config: { notificationSound: "none" } },
  commit(type, value) { if (type === "setNotificatios") this.getters.notifications = value; },
};
const originalSetTimeout = global.setTimeout;
global.setTimeout = (callback, delay) => ({ callback, delay });

notifications.refreshDayNotifications({ $store: store });
setImmediate(() => {
  try {
    assert.strictEqual(store.getters.notifications.length, 1, "unloaded lists must still produce reminders");
    assert.strictEqual(store.getters.notifications[0].delay, 30 * 60 * 1000);
    process.stdout.write("Deadline reminder scan tests passed.\n");
  } finally {
    global.setTimeout = originalSetTimeout;
  }
});
