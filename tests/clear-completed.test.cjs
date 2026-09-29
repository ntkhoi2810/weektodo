const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");
const { parse } = require("@vue/compiler-sfc");

function load(filename, source, overrides) {
  const compiled = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => Object.prototype.hasOwnProperty.call(overrides, name)
    ? overrides[name] : originalRequire(name);
  loaded._compile(compiled, filename);
  return loaded.exports.default;
}

const storeFile = path.resolve(__dirname, "../src/store/modules/todolist.store.js");
const todoStore = load(storeFile, fs.readFileSync(storeFile, "utf8"), {
  "../../repositories/dbRepository": {},
  "../../helpers/deadline": {},
});
const recurring = { text: "Recurring occurrence", checked: true, repeatingEvent: "rule-1" };
const completed = { text: "Done", checked: true };
const active = { text: "Keep", checked: false };
const state = { todoLists: { "20260929": [recurring, active, completed], personal: [{ text: "Other", checked: true }] } };
todoStore.mutations.clearCompletedTodos(state, "20260929");
assert.deepStrictEqual(state.todoLists["20260929"], [active]);
assert.strictEqual(state.todoLists.personal.length, 1, "other lists must remain intact");

const writes = [];
const refreshes = [];
const modalFile = path.resolve(__dirname, "../src/components/comfirmModals/clearCompletedModal.vue");
const modalScript = parse(fs.readFileSync(modalFile, "utf8")).descriptor.script.content;
const modal = load(modalFile, modalScript, {
  "../comfirmModal.vue": {},
  "../../repositories/toDoListRepository": { update: (id, tasks) => writes.push({ id, tasks }) },
  "../../helpers/notifications": { refreshDayNotifications: () => refreshes.push(true) },
});
const view = {
  $store: {
    getters: { completedToClearId: "personal", todoLists: state.todoLists },
    commit(type, id) { todoStore.mutations[type](state, id); },
  },
};
Object.defineProperty(view, "listId", { get: () => modal.computed.listId.call(view) });
Object.defineProperty(view, "completedCount", { get: () => modal.computed.completedCount.call(view) });
modal.methods.clearCompleted.call(view);
assert.deepStrictEqual(state.todoLists.personal, []);
assert.deepStrictEqual(writes, [{ id: "personal", tasks: [] }]);
assert.strictEqual(refreshes.length, 1);
modal.methods.clearCompleted.call(view);
assert.strictEqual(writes.length, 1, "empty lists must not be written again");

process.stdout.write("Clear completed list tests passed.\n");
