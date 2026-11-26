import { Toast } from "bootstrap";
import toDoListRepository from "../repositories/toDoListRepository";
import notifications from "./notifications";
import tasksHelper from "./tasksHelper";

export function persistTodoList(vue, listId, { reorder = false } = {}) {
  const store = vue.$store;
  let list = store.getters.todoLists[listId] || [];
  if (reorder && store.getters.config.autoReorderTasks) {
    list = tasksHelper.reorderTasksList(list);
  }
  toDoListRepository.update(listId, list);
  notifications.refreshDayNotifications(vue, listId);
  return list;
}

export async function moveTaskWithFeedback(vue, payload) {
  const store = vue.$store;
  const result = await store.dispatch("moveTask", payload);
  if (!result) return null;

  if (payload.fromListId !== payload.toListId) {
    persistTodoList(vue, payload.fromListId);
  }
  persistTodoList(vue, payload.toListId, { reorder: payload.respectAutoReorder !== false });

  if (payload.showUndoToast) {
    store.commit("setUndoElement", {
      type: "move",
      movedTask: result.movedTask,
      fromListId: result.fromListId,
      fromIndex: result.fromIndex,
      toListId: result.toListId,
      insertIndex: result.insertIndex,
      previousSnapshot: result.previousSnapshot,
      toastMessage: payload.toastMessage || "",
    });
    if (typeof vue.$nextTick === "function") await vue.$nextTick();
    const toastEl = typeof document !== "undefined" ? document.getElementById("taskMoved") : null;
    if (toastEl) Toast.getOrCreateInstance(toastEl).show();
  }
  return result;
}
