const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");

function loadModule(filename, overrides = {}) {
  const source = fs.readFileSync(filename, "utf8");
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
const taskOps = loadModule(path.resolve(__dirname, "../src/helpers/taskOperations.js"));
const todoStore = loadModule(path.resolve(__dirname, "../src/store/modules/todolist.store.js"), {
  "../../repositories/dbRepository": {},
  "../../helpers/deadline": deadline,
}).default;

// 1. Reorder index math (prevents off-by-one when dragging downwards)
assert.deepStrictEqual(taskOps.computeReorderIndex(0, 2, "before"), { moved: true, insertIndex: 1 });
assert.deepStrictEqual(taskOps.computeReorderIndex(0, 2, "after"), { moved: true, insertIndex: 2 });
assert.deepStrictEqual(taskOps.computeReorderIndex(0, 1, "before"), { moved: false, insertIndex: 0 });
assert.deepStrictEqual(taskOps.computeReorderIndex(2, 0, "before"), { moved: true, insertIndex: 0 });
assert.deepStrictEqual(taskOps.computeReorderIndex(2, 0, "after"), { moved: true, insertIndex: 1 });
assert.deepStrictEqual(taskOps.computeReorderIndex(2, 1, "after"), { moved: false, insertIndex: 2 });
assert.deepStrictEqual(taskOps.computeReorderIndex("bad", 1, "before"), { moved: false, insertIndex: -1 });

// Cross-list insert clamping
assert.strictEqual(taskOps.computeCrossListIndex(1, "before", 4), 1);
assert.strictEqual(taskOps.computeCrossListIndex(1, "after", 4), 2);
assert.strictEqual(taskOps.computeCrossListIndex(9, "after", 3), 3);

// 2. Quick deadline presets (F6) & Next Week (F5)
// 2026-11-26 is Thursday
const thuNow = "2026-11-26 10:00";
assert.strictEqual(taskOps.computeQuickDeadline("none", { now: thuNow }), null);
assert.strictEqual(taskOps.computeQuickDeadline("today", { now: thuNow }), "2026-11-26");
assert.strictEqual(taskOps.computeQuickDeadline("tomorrow", { now: thuNow }), "2026-11-27");
assert.strictEqual(taskOps.computeQuickDeadline("nextWeek", { now: thuNow, weekStartOnMonday: true }), "2026-11-30");
assert.strictEqual(taskOps.computeQuickDeadline("nextWeek", { now: thuNow, weekStartOnMonday: false }), "2026-11-29");
assert.strictEqual(taskOps.computeNextWeekListId({ now: thuNow, weekStartOnMonday: true }), "20261130");
assert.strictEqual(taskOps.computeQuickDeadline("2026-12-05", { now: thuNow }), "2026-12-05");

// Build move patch avoids stale overdue badge when postponing to later calendar day
assert.deepStrictEqual(
  taskOps.buildMovePatch({ deadlineDate: "2026-11-20" }, "20261126"),
  { deadlineDate: "2026-11-26" }
);
assert.deepStrictEqual(
  taskOps.buildMovePatch({ deadlineDate: "2026-11-30" }, "20261126"),
  {}
);
assert.deepStrictEqual(
  taskOps.buildMovePatch({ deadlineDate: "2026-11-20" }, "custom-list-1"),
  {}
);

// 3. Preserve manual order in groupTasksByDeadline and groupAllTasksByList
const datedTasks = [
  { text: "Late time but dragged first", checked: false, deadlineDate: "2026-11-26", deadlineTime: "18:00" },
  { text: "Early time dragged second", checked: false, deadlineDate: "2026-11-26", deadlineTime: "08:00" },
];
assert.deepStrictEqual(
  deadline.groupTasksByDeadline(datedTasks).groups[0].tasks.map(e => e.task.text),
  ["Early time dragged second", "Late time but dragged first"]
);
assert.deepStrictEqual(
  deadline.groupTasksByDeadline(datedTasks, { preserveManualOrder: true }).groups[0].tasks.map(e => e.task.text),
  ["Late time but dragged first", "Early time dragged second"]
);

const entries = allTasks.collectAllTasks(
  {
    work: [
      { text: "Second visually by date, first in array", checked: false, deadlineDate: "2026-11-29" },
      { text: "First visually by date, second in array", checked: false, deadlineDate: "2026-11-26" },
    ],
  },
  [{ listId: "work", listName: "Work" }],
  { now: thuNow }
);
assert.deepStrictEqual(
  allTasks.groupAllTasksByList(entries, [{ listId: "work", listName: "Work" }], { preserveManualOrder: true })
    .groups[0].tasks.map(e => e.task.text),
  ["Second visually by date, first in array", "First visually by date, second in array"]
);

// 4. Active drag payload fallback & AllTasks deadline group reordering
taskOps.setDragPayload(null, { toDo: { text: "Drag fallback", listId: "work" }, index: 1, listId: "work" });
assert.strictEqual(taskOps.isTaskDragEvent({}), true, "activeDragPayload enables drag detection even without dataTransfer");
assert.deepStrictEqual(taskOps.getDragPayload({}), {
  listId: "work",
  index: 1,
  toDo: { text: "Drag fallback", listId: "work" },
});
taskOps.clearDragPayload();
assert.strictEqual(taskOps.isTaskDragEvent({}), false);
assert.strictEqual(taskOps.getDragPayload({}), null);

const multiListLists = {
  work: [
    { text: "Work task A", checked: false, deadlineDate: "2026-11-26", deadlineTime: "11:00" },
    { text: "Work task B", checked: false, deadlineDate: "2026-11-26", deadlineTime: "15:00" },
  ],
  personal: [
    { text: "Personal task C", checked: false, deadlineDate: "2026-11-26", deadlineTime: "13:00" },
  ],
};
const multiCustom = [
  { listId: "work", listName: "Work" },
  { listId: "personal", listName: "Personal" },
];
let initialDeadlineGroups = allTasks.groupAllTasksByDeadline(
  allTasks.collectAllTasks(multiListLists, multiCustom, { now: thuNow }),
  thuNow,
  { preserveManualOrder: true }
).groups;
assert.deepStrictEqual(
  initialDeadlineGroups[0].tasks.map(e => e.task.text),
  ["Work task A", "Personal task C", "Work task B"]
);

// Drag "Work task B" (group index 2) before "Work task A" (group index 0)
const groupReorder = taskOps.reorderGroupTasks(initialDeadlineGroups[0].tasks, 2, 0, "before");
assert.strictEqual(groupReorder.moved, true);
assert.deepStrictEqual(groupReorder.affectedListIds.sort(), ["personal", "work"]);
assert.deepStrictEqual(groupReorder.sameListReorder, { listId: "work", fromIndex: 1, toIndex: 0 });

let reorderedDeadlineGroups = allTasks.groupAllTasksByDeadline(
  allTasks.collectAllTasks(multiListLists, multiCustom, { now: thuNow }),
  thuNow,
  { preserveManualOrder: true }
).groups;
assert.deepStrictEqual(
  reorderedDeadlineGroups[0].tasks.map(e => e.task.text),
  ["Work task B", "Work task A", "Personal task C"],
  "AllTasks deadline view must preserve manual order across different lists"
);

// 5. Vuex reorderTodo, moveTodoBetweenLists, and moveTask + Undo flow
const state = {
  todoLists: {
    work: [
      { text: "Task 1", checked: false, listId: "work", deadlineDate: null, alarm: false, repeatingEvent: null },
      { text: "Task 2", checked: false, listId: "work", deadlineDate: "2026-11-28", alarm: true, repeatingEvent: null },
      { text: "Task 3", checked: false, listId: "work", deadlineDate: null, alarm: false, repeatingEvent: null },
    ],
    "20261126": [
      { text: "Today task", checked: false, listId: "20261126", deadlineDate: null, alarm: false, repeatingEvent: "rep-1" },
    ],
  },
};

// Drag Task 1 (0) after Task 3 (2) -> insertIndex = 2
const { insertIndex } = taskOps.computeReorderIndex(0, 2, "after");
todoStore.mutations.reorderTodo(state, { listId: "work", fromIndex: 0, toIndex: insertIndex });
assert.deepStrictEqual(state.todoLists.work.map(t => t.text), ["Task 2", "Task 3", "Task 1"]);

// Move Task 2 (now index 0 in work) to 20261126 and undo via moveTask action
(async () => {
  const ctx = {
    state,
    commit(type, payload) { todoStore.mutations[type](state, payload); },
    dispatch() { throw new Error("unexpected loadTodoLists for preloaded list"); },
  };
  const moveResult = await todoStore.actions.moveTask(ctx, {
    fromListId: "work",
    fromIndex: 0,
    toListId: "20261126",
    toIndex: 0,
  });
  assert.strictEqual(moveResult.fromListId, "work");
  assert.strictEqual(moveResult.fromIndex, 0);
  assert.strictEqual(moveResult.toListId, "20261126");
  assert.strictEqual(moveResult.insertIndex, 0);
  assert.strictEqual(state.todoLists["20261126"][0].text, "Task 2");
  assert.strictEqual(state.todoLists["20261126"][0].listId, "20261126");
  assert.strictEqual(state.todoLists.work.length, 2);

  // Undo back to original position and snapshot
  await todoStore.actions.moveTask(ctx, {
    fromListId: moveResult.toListId,
    fromIndex: state.todoLists[moveResult.toListId].indexOf(moveResult.movedTask),
    toListId: moveResult.fromListId,
    toIndex: moveResult.fromIndex,
    patch: {
      deadlineDate: moveResult.previousSnapshot.deadlineDate,
      alarm: moveResult.previousSnapshot.alarm,
      repeatingEvent: moveResult.previousSnapshot.repeatingEvent,
    },
  });
  assert.deepStrictEqual(state.todoLists.work.map(t => t.text), ["Task 2", "Task 3", "Task 1"]);
  assert.strictEqual(state.todoLists["20261126"].length, 1);

  process.stdout.write("Task drag reorder, quick move, and quick add tests passed.\n");
})().catch(err => {
  console.error(err);
  process.exit(1);
});
