const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");
const { parse } = require("@vue/compiler-sfc");

function loadModule(filename, overrides = {}, sourceOverride = null) {
  const source = sourceOverride !== null ? sourceOverride : fs.readFileSync(filename, "utf8");
  const compiled = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = name => Object.prototype.hasOwnProperty.call(overrides, name)
    ? overrides[name] : originalRequire(name);
  mod._compile(compiled, filename);
  return mod.exports;
}

const deadline = loadModule(path.resolve(__dirname, "../src/helpers/deadline.js"));
const allTasks = loadModule(path.resolve(__dirname, "../src/helpers/allTasks.js"), {
  "./deadline": deadline,
});

// 1. Overdue detection tests (F1)
const now = "2026-11-25 14:30";
assert.strictEqual(deadline.isTaskOverdue({ checked: false, deadlineDate: "2026-11-24", deadlineTime: null }, now), true);
assert.strictEqual(deadline.isTaskOverdue({ checked: false, deadlineDate: "2026-11-25", deadlineTime: null }, now), false, "date-only today is not overdue");
assert.strictEqual(deadline.isTaskOverdue({ checked: false, deadlineDate: "2026-11-25", deadlineTime: "14:00" }, now), true, "earlier time today is overdue");
assert.strictEqual(deadline.isTaskOverdue({ checked: false, deadlineDate: "2026-11-25", deadlineTime: "15:00" }, now), false, "later time today is not overdue");
assert.strictEqual(deadline.isTaskOverdue({ checked: true, deadlineDate: "2026-11-20", deadlineTime: "09:00" }, now), false, "completed task is never overdue");
assert.strictEqual(deadline.isTaskOverdue({ checked: false, deadlineDate: null, deadlineTime: "09:00" }, now), false);

// 2. Collect, summarize, filter, and group tests (F0)
const customLists = [
  { listId: "work", listName: "Work" },
  { listId: "personal", listName: "Personal" },
];
const todoLists = {
  work: [
    { text: "Past report", checked: false, deadlineDate: "2026-11-23", deadlineTime: "10:00", color: "#ed544b", desc: "Q4 numbers", subTaskList: [] },
    { text: "Due today afternoon", checked: false, deadlineDate: "2026-11-25", deadlineTime: "16:00", color: "#5e6ef2", desc: "", subTaskList: [{ text: "Check charts", checked: false }] },
    { text: "Backlog idea", checked: false, deadlineDate: null, deadlineTime: null, color: "none", desc: "", subTaskList: [] },
    { text: "Shipped feature", checked: true, deadlineDate: "2026-11-20", deadlineTime: null, color: "none", desc: "", subTaskList: [] },
  ],
  personal: [
    { text: "Book dentist", checked: false, deadlineDate: "2026-11-26", deadlineTime: "09:00", color: "#77e785", desc: "", subTaskList: [] },
  ],
  "20261124": [
    { text: "Yesterday calendar task", checked: false, deadlineDate: null, deadlineTime: null, color: "none", desc: "", subTaskList: [] },
  ],
  "20261125": [
    { text: "Today calendar task", checked: false, deadlineDate: null, deadlineTime: null, color: "none", desc: "", subTaskList: [] },
  ],
  "20261128": [
    { text: "Future calendar task", checked: false, deadlineDate: null, deadlineTime: null, color: "none", desc: "", subTaskList: [] },
  ],
  deletedOrphanList: [
    { text: "Should be ignored", checked: false, deadlineDate: null, deadlineTime: null },
  ],
};

const entries = allTasks.collectAllTasks(todoLists, customLists, { now });
assert.strictEqual(entries.length, 8, "orphan lists must be excluded while active custom + calendar lists are included");

const summary = allTasks.computeTaskSummary(entries);
assert.deepStrictEqual(summary, {
  total: 7,
  overdue: 2,
  today: 2,
  upcoming: 2,
  noDeadline: 1,
  custom: 4,
  calendar: 3,
});
assert.strictEqual(summary.overdue + summary.today + summary.upcoming + summary.noDeadline, summary.total);

// Filtering
assert.strictEqual(allTasks.filterAllTasks(entries, { source: "custom" }).filter(e => !e.task.checked).length, 4);
assert.strictEqual(allTasks.filterAllTasks(entries, { source: "calendar" }).filter(e => !e.task.checked).length, 3);
assert.strictEqual(allTasks.filterAllTasks(entries, { source: "personal" }).length, 1);
assert.strictEqual(allTasks.filterAllTasks(entries, { bucket: "overdue" }).filter(e => !e.task.checked).length, 2);
assert.strictEqual(allTasks.filterAllTasks(entries, { color: "#ed544b" }).length, 1);
assert.strictEqual(allTasks.filterAllTasks(entries, { query: "charts" }).length, 1, "search matches subtask text");
assert.strictEqual(allTasks.filterAllTasks(entries, { query: "q4" }).length, 1, "search matches description");
assert.strictEqual(allTasks.filterAllTasks(entries, { query: "personal" }).length, 1, "search matches source list name");

// Grouping by deadline
const byDeadline = allTasks.groupAllTasksByDeadline(entries, now);
assert.deepStrictEqual(byDeadline.groups.map(g => g.kind), ["overdue", "today", "tomorrow", "date", "noDeadline"]);
assert.deepStrictEqual(byDeadline.groups[0].tasks.map(e => e.task.text), ["Past report", "Yesterday calendar task"]);
assert.strictEqual(byDeadline.completed.length, 1);

// Grouping by list preserves custom list order then chronological calendar dates
const byList = allTasks.groupAllTasksByList(entries, customLists);
assert.deepStrictEqual(byList.groups.map(g => g.listId), ["work", "personal", "20261124", "20261125", "20261128"]);
assert.strictEqual(byList.completed.length, 1);

// 3. Foundational fixes tests (F9)
const storeFile = path.resolve(__dirname, "../src/store/modules/todolist.store.js");
const todoStore = loadModule(storeFile, {
  "../../repositories/dbRepository": {},
  "../../helpers/deadline": deadline,
}).default;

const state = { todoLists: { "20261125": [{ text: "Keep live", checked: false }] }, allListsLoaded: false };
todoStore.mutations.mergeAllTodoLists(state, {
  "20261125": [{ text: "Stale from DB", checked: false }],
  "20261126": [{ text: "Loaded from DB", checked: false }],
});
assert.strictEqual(state.allListsLoaded, true);
assert.strictEqual(state.todoLists["20261125"][0].text, "Keep live", "mergeAllTodoLists must not overwrite already-loaded Vuex lists");
assert.strictEqual(state.todoLists["20261126"][0].text, "Loaded from DB");

// moveUndoneItems must not crash when destinyId is missing in Vuex
const moveState = { todoLists: { "20261125": [{ text: "Postpone me", checked: false, listId: "20261125" }] } };
todoStore.mutations.moveUndoneItems(moveState, { origenId: "20261125", destinyId: "20261126" });
assert.strictEqual(moveState.todoLists["20261125"].length, 0);
assert.strictEqual(moveState.todoLists["20261126"].length, 1);
assert.strictEqual(moveState.todoLists["20261126"][0].listId, "20261126");

// duplicateTodo deep-clones subTaskList & checkTodo preserves index when moveCompletedTaskToBottom is false
const modalFile = path.resolve(__dirname, "../src/views/toDoModal/toDoModal.vue");
const modalScript = parse(fs.readFileSync(modalFile, "utf8")).descriptor.script.content;
const modalComp = loadModule(modalFile, {
  "vue3-datepicker": {},
  "../../repositories/toDoListRepository": { update: () => {} },
  "../../repositories/dbRepository": {},
  "bootstrap": { Toast: function () { this.show = () => {}; }, Modal: function () { this.show = () => {}; } },
  "../../components/toastMessage": {},
  "./colorPicker": {},
  "./timePicker": {},
  "./repeatingEvent": {},
  "../../helpers/notifications": { refreshDayNotifications: () => {} },
  "../../helpers/repeatingEvents.js": {},
  "../../helpers/languageHelper.js": {},
  "../../repositories/repeatingEventRepository": {},
  "../../components/comfirmModal.vue": {},
  "linkify-string": s => s,
  "@manuelernestog/click-handler": function () {},
  "../../helpers/tasksHelper": { reorderTasksList: l => l },
  "./descriptionTextArea.vue": {},
  "../../helpers/deadline": deadline,
}, modalScript).default;

const originalSubtasks = [{ text: "Sub 1", checked: false }];
const modalLists = { work: [{ text: "First", checked: true, listId: "work", subTaskList: originalSubtasks, tags: ["a"] }, { text: "Second", checked: false, listId: "work", subTaskList: [] }] };
const fakeDocument = global.document;
global.document = { getElementById: () => ({}) };
try {
  const modalCtx = {
    todo: modalLists.work[0],
    todoList: modalLists.work,
    index: 0,
    $store: {
      getters: { config: { moveCompletedTaskToBottom: false, autoReorderTasks: false }, todoLists: modalLists },
      commit(type, payload) {
        if (type === "addTodo") modalLists[payload.listId].push(payload);
      },
    },
    updateTodoList() {},
    updateTodoWithReorder() {},
  };
  modalComp.methods.checkTodo.call(modalCtx, false);
  assert.strictEqual(modalCtx.index, 0, "index must stay 0 when moveCompletedTaskToBottom is false");

  modalComp.methods.duplicateTodo.call(modalCtx);
  const duplicated = modalLists.work[2];
  duplicated.subTaskList[0].checked = true;
  assert.strictEqual(originalSubtasks[0].checked, false, "duplicated subtasks must not share references with original");
} finally {
  global.document = fakeDocument;
}

process.stdout.write("All tasks overview, overdue, and foundational fix tests passed.\n");
