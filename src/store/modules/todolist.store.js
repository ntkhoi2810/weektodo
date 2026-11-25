import dbRepository from "../../repositories/dbRepository";
import { normalizeDeadline } from "../../helpers/deadline";

const state = {
  todoLists: {},
  cTodoListIds: [],
  selectedDates: [],
  allListsLoaded: false,
};

const getters = {
  todoLists(state) {
    return state.todoLists;
  },
  cTodoListIds(state) {
    return state.cTodoListIds;
  },
  selectedDates(state) {
    return state.selectedDates;
  },
  allListsLoaded(state) {
    return state.allListsLoaded;
  },
};

const mutations = {
  loadTodoLists(state, obj) {
    state.todoLists[obj.todoListId] = obj.todoList;
  },
  mergeAllTodoLists(state, lists) {
    Object.keys(lists).forEach(listId => {
      if (!Object.prototype.hasOwnProperty.call(state.todoLists, listId)) {
        state.todoLists[listId] = lists[listId];
      }
    });
    state.allListsLoaded = true;
  },
  clearTodoList(state, obj) {
    state.todoLists[obj] = [];
  },
  clearCompletedTodos(state, listId) {
    if (state.todoLists[listId]) {
      state.todoLists[listId] = state.todoLists[listId].filter(todo => !todo.checked);
    }
  },
  checkTodo(state, obj) {
    state.todoLists[obj.toDoListId][obj.index].checked = !state.todoLists[obj.toDoListId][obj.index].checked;
  },
  moveTodoToEnd(state, obj) {
      state.todoLists[obj.toDoListId].push(state.todoLists[obj.toDoListId].splice(obj.index, 1)[0]);
  },
  addTodo(state, toDo) {
    if (!state.todoLists[toDo.listId]) state.todoLists[toDo.listId] = [];
    state.todoLists[toDo.listId].push(toDo);
  },
  updateTodo(state, obj) {
    state.todoLists[obj.toDoListId][obj.index].repeatingEvent = null;
    state.todoLists[obj.toDoListId][obj.index].text = obj.text;
  },
  removeTodo(state, obj) {
    state.todoLists[obj.toDoListId].splice(obj.index, 1);
  },
  insertTodo(state, obj) {
    if (!state.todoLists[obj.toDoListId]) state.todoLists[obj.toDoListId] = [];
    state.todoLists[obj.toDoListId].splice(obj.index, 0, obj.toDo);
  },
  checkAllItems(state, toDoListId) {
    state.todoLists[toDoListId].forEach((toDo) => {
      toDo.checked = true;
    });
  },
  moveUndoneItems(state, obj) {
    if (!state.todoLists[obj.origenId]) return;
    if (!state.todoLists[obj.destinyId]) state.todoLists[obj.destinyId] = [];
    for (let i = state.todoLists[obj.origenId].length - 1; i >= 0; i--) {
      if (!state.todoLists[obj.origenId][i].checked) {
        state.todoLists[obj.origenId][i].repeatingEvent = null;
        state.todoLists[obj.origenId][i].listId = obj.destinyId;
        state.todoLists[obj.destinyId].unshift(state.todoLists[obj.origenId][i]);
        state.todoLists[obj.origenId].splice(i, 1);
      }
    }
  },
  loadCustomTodoListsIds(state, obj) {
    state.cTodoListIds = obj;
  },
  newCustomTodoList(state, obj) {
    state.cTodoListIds.push(obj);
    this.commit("loadTodoLists", { todoListId: obj.listId, todoList: [] });
  },
  removeCustomTodoList(state, obj) {
    delete state.todoLists[obj.id];
    state.cTodoListIds.splice(obj.index, 1);
  },
  updateCustomTodoList(state, obj) {
    state.cTodoListIds[obj.index].listName = obj.name;
  },
  updateSelectedDates(state, selectedDates) {
    state.selectedDates = selectedDates;
  },
};

const actions = {
  loadTodoLists({ commit }, todoListId) {
    return new Promise((resolve) => {
      let db_req = dbRepository.open();
      db_req.onsuccess = function (event) {
        let db = event.target.result;
        var get_req = dbRepository.get(db, "todo_lists", todoListId);
        get_req.onsuccess = function (event) {
          let todoList = event.target.result;
          if (todoList) {
            const changed = todoList.reduce((updated, task) => normalizeDeadline(task, todoListId) || updated, false);
            commit("loadTodoLists", { todoListId: todoListId, todoList: todoList });
            if (changed) {
              const updateReq = dbRepository.update(db, "todo_lists", todoListId, todoList);
              updateReq.onsuccess = () => { db.close(); resolve(); };
              updateReq.onerror = () => { db.close(); resolve(); };
              return;
            }
          } else {
            commit("loadTodoLists", { todoListId: todoListId, todoList: [] });
            const addReq = dbRepository.add(db, "todo_lists", todoListId, []);
            addReq.onsuccess = () => { db.close(); resolve(); };
            addReq.onerror = () => { db.close(); resolve(); };
            return;
          }
          db.close();
          resolve();
        };
        get_req.onerror = function () {
          db.close();
          resolve();
        };
      };
      db_req.onerror = function () {
        resolve();
      };
    });
  },
  loadAllTodoLists({ commit }) {
    return new Promise((resolve) => {
      let db_req = dbRepository.open();
      db_req.onsuccess = function (event) {
        let db = event.target.result;
        const lists = {};
        const cursorReq = dbRepository.selectAll(db, "todo_lists");
        cursorReq.onsuccess = function () {
          const cursor = cursorReq.result;
          if (cursor) {
            const listId = cursor.key;
            const todoList = Array.isArray(cursor.value) ? cursor.value : [];
            todoList.forEach(task => normalizeDeadline(task, listId));
            lists[listId] = todoList;
            cursor.continue();
          } else {
            db.close();
            commit("mergeAllTodoLists", lists);
            resolve(lists);
          }
        };
        cursorReq.onerror = function () {
          db.close();
          commit("mergeAllTodoLists", lists);
          resolve(lists);
        };
      };
      db_req.onerror = function () {
        resolve({});
      };
    });
  },
};

export default {
  namespaced: false,
  state,
  getters,
  actions,
  mutations,
};
