<template>
  <div :id="'list' + id" class="to-do-list-container d-flex flex-column" ref="listContainer" :class="{
    'old-date': !customTodoList && moments(id).isBefore(Date(), 'day'),
  }">
    <div v-if="loading" class="loading-spinner">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <list-header :id="id" :customTodoList="customTodoList" :cTodoListIndex="cTodoListIndex" :toDoList="toDoListState" @focus-day="$emit('focus-day', id)">
    </list-header>
    <ul class="to-do-list" @dragleave="onListDragLeave">
      <li v-for="(toDo, index) in toDoListState" :key="index">
        <div class="drop-zone" @drop.prevent="onDrop($event, id, index)" @dragover.prevent="onItemDragOver($event, index)" @dragenter.prevent="onItemDragOver($event, index)">
          <to-do-item :to-do="toDo" :index="index" :to-do-list-id="id"
            :drop-position="dropTarget && dropTarget.index === index ? dropTarget.position : ''"></to-do-item>
        </div>
      </li>
    </ul>
    <div class="fake-drop-zone flex-grow-1 margin-bottom-2" @drop.prevent="onDropAtEnd($event, id)"
      @dragenter="onDragenter" @dragleave="onDragleave" @dragover.prevent="onEndDragOver"
      :class="{ 'fake-drag-hover': fakeItemsDragHover }">
      <div class="todo-item-container">
        <input class="todo-input new-todo-input" type="text" ref="newToDoInput" v-model="newToDo.text" :placeholder="$t('ui.newTask')" @blur="addToDo()"
          @keyup.enter="addToDo()" @keyup.esc="cancelAdd()" />
      </div>
      <div class="fake-lines" :class="{ 'custom-list': customTodoList }" @click="$refs.newToDoInput.focus()"></div>
    </div>
  </div>
</template>

<script>
import toDoItem from "./toDoItem";
import moment from "moment";
import toDoListRepository from "../repositories/toDoListRepository";
import listHeader from "./listHeader";
import notifications from "../helpers/notifications";
import repeatingEventHelper from "../helpers/repeatingEvents.js";
import {
  buildMovePatch,
  clearDragPayload,
  computeCrossListIndex,
  computeDropPosition,
  computeReorderIndex,
  getDragPayload,
  isTaskDragEvent,
} from "../helpers/taskOperations";
import { moveTaskWithFeedback, persistTodoList } from "../helpers/taskActions";

export default {
  components: {
    listHeader,
    toDoItem,
  },
  emits: ["todoListMounted", "focus-day"],
  props: {
    id: { required: false, type: String },
    customTodoList: { required: false, default: false, type: Boolean },
    cTodoListIndex: { required: false, type: Number },
    showCustomList: { required: false, type: Boolean },
  },
  data() {
    return {
      newToDo: { text: "", checked: false },
      fakeItemCounts: 6,
      fakeItemsDragHover: false,
      dropTarget: null,
      loading: false,
    };
  },
  mounted() {
    this.setTodoListHeight();
    window.addEventListener("resize", this.setTodoListHeight);
    let listId = this.id;
    this.loading = true;
    this.$store.dispatch("loadTodoLists", listId).then(() => {
      this.$store.dispatch("loadRepeatingEventGeneratedByDate", listId).then(() => {
        this.loading = false;
        repeatingEventHelper.generateRepeatingEventsIntances(listId, this);
        this.$emit("todoListMounted", listId);
      });
      this.clearRemovedRepeatingEvents();
    });
  },
  unmounted() {
    window.removeEventListener("resize", this.setTodoListHeight);
  },
  beforeCreate() {
    let listId = this.id;
    this.$store.commit("loadTodoLists", { todoListId: listId, todoList: [] });
  },
  methods: {
    addToDo: function () {
      if (this.newToDo.text != "") {
        var newTodo = {
          text: this.newToDo.text,
          checked: false,
          listId: this.id,
          desc: "",
          subTaskList: [],
          color: "none",
          priority: 0,
          tags: [],
          time: null,
          deadlineDate: null,
          deadlineTime: null,
          alarm: false,
          repeatingEvent: null,
        };
        this.$store.commit("addTodo", newTodo);
        this.updateTodoList(this.id, this.$store.getters.todoLists[this.id]);
        this.newToDo.text = "";
      }
    },
    cancelAdd: function () {
      this.newToDo.text = "";
    },
    moments: function (date) {
      return moment(date);
    },
    onItemDragOver: function (event, index) {
      if (!isTaskDragEvent(event)) return;
      this.fakeItemsDragHover = false;
      this.dropTarget = { index, position: computeDropPosition(event) };
    },
    onListDragLeave: function (event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.dropTarget = null;
      }
    },
    onEndDragOver: function (event) {
      if (!isTaskDragEvent(event)) return;
      this.dropTarget = null;
      this.fakeItemsDragHover = true;
    },
    onDrop: async function (event, targetListId, targetIndex) {
      const position = this.dropTarget && this.dropTarget.index === targetIndex
        ? this.dropTarget.position
        : computeDropPosition(event);
      this.dropTarget = null;
      this.fakeItemsDragHover = false;

      const payload = getDragPayload(event);
      clearDragPayload();
      if (!payload) return;

      if (payload.listId === targetListId) {
        const { moved, insertIndex } = computeReorderIndex(payload.index, targetIndex, position);
        if (!moved) return;
        this.$store.commit("reorderTodo", { listId: targetListId, fromIndex: payload.index, toIndex: insertIndex });
        persistTodoList(this, targetListId, { reorder: true });
      } else {
        const targetList = this.$store.getters.todoLists[targetListId] || [];
        const insertIndex = computeCrossListIndex(targetIndex, position, targetList.length);
        const patch = buildMovePatch(payload.toDo, targetListId);
        await moveTaskWithFeedback(this, {
          fromListId: payload.listId,
          fromIndex: payload.index,
          toListId: targetListId,
          toIndex: insertIndex,
          patch,
        });
      }
    },
    onDropAtEnd: async function (event, targetListId) {
      this.fakeItemsDragHover = false;
      this.dropTarget = null;

      const payload = getDragPayload(event);
      clearDragPayload();
      if (!payload) return;

      if (payload.listId === targetListId) {
        const list = this.$store.getters.todoLists[targetListId] || [];
        if (!list.length) return;
        const { moved, insertIndex } = computeReorderIndex(payload.index, list.length - 1, "after");
        if (!moved) return;
        this.$store.commit("reorderTodo", { listId: targetListId, fromIndex: payload.index, toIndex: insertIndex });
        persistTodoList(this, targetListId, { reorder: true });
      } else {
        const patch = buildMovePatch(payload.toDo, targetListId);
        await moveTaskWithFeedback(this, {
          fromListId: payload.listId,
          fromIndex: payload.index,
          toListId: targetListId,
          toIndex: null,
          patch,
        });
      }
    },
    updateTodoList: function (todoListId, TodoList) {
      notifications.refreshDayNotifications(this, todoListId);
      toDoListRepository.update(todoListId, TodoList);
    },
    setTodoListHeight: function () {
      if (this.showCustomList) {
        this.fakeItemCounts = Math.floor(this.$refs.listContainer.clientHeight / 40);
      } else {
        this.fakeItemCounts = Math.floor(this.$refs.listContainer.clientHeight / 34);
      }
    },
    onDragenter: function (event) {
      if (!isTaskDragEvent(event)) return;
      this.dropTarget = null;
      this.fakeItemsDragHover = true;
    },
    onDragleave: function (event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.fakeItemsDragHover = false;
      }
    },
    clearRemovedRepeatingEvents: function () {
      if (this.customTodoList) return;
      repeatingEventHelper.removeGeneratedRepeatingEvents(this.id, this);
    },
  },
  watch: {
    showCustomList: function () {
      this.$nextTick(function () {
        this.setTodoListHeight();
      });
    },
  },
  computed: {
    toDoListState: function () {
      return this.$store.getters.todoLists[this.id] || [];
    },
    columns: function () {
      if (this.customTodoList)
        return this.$store.getters.config.customColumns;
        
      return this.$store.getters.config.columns;
    },
  },
};
</script>

<style scoped>
.to-do-list {
  list-style: none;
  padding-inline-start: 0px;
  margin-bottom: 0px;
}

.to-do-list li {
  -webkit-transition: all 0.4s ease-out;
  transition: all 0.4s ease-out;
}

.todo-input {
  height: 1.28rem;
  line-height: 1.3rem;
  font-size: 0.865rem;
  margin: 2px 0px 2px 0px;
  padding: 0 6px 0 6px;
}

.to-do-list-container {
  padding-left: 13px;
  padding-right: 13px;
  scroll-snap-align: start;
  margin-bottom: 5px;
}

.to-do-fake-item {
  height: 1.2rem;
  width: 100%;
}

.weekly-to-do-header h4 {
  margin-bottom: 4px;
}

.weekly-to-do-header span {
  margin-top: 0px;
}

.weekly-to-do-header i {
  color: grey;
}

.weekly-to-do-header i:hover {
  color: black;
}
.weekly-to-do-header i {
  font-size: 1.4rem;
  flex-grow: 0;
  align-self: start;
  cursor: pointer;
}

.fake-item-container {
  border-bottom: 1px solid #eaecef;
  height: 1.6rem;
}

.dark-theme .fake-item-container {
  border-bottom: 1px solid #30363d;
}

.fake-drop-zone * {
  pointer-events: none;
}

.fake-drop-zone:hover * {
  pointer-events: unset;
}

.fake-drag-hover .todo-item-container {
  box-shadow: rgb(244, 243, 243) 0px 0px 4px 1px inset;
  background-color: rgb(250, 249, 249);
}

.dark-theme .fake-drag-hover .todo-item-container {
  box-shadow: #0b0d12 0px 0px 4px 1px inset;
  background-color: #0c0d14;
}

.fake-drag-hover input,
.dark-theme .fake-drag-hover input {
  background-color: unset;
}

.fake-lines {
  background-image: linear-gradient(0deg,
      #ffffff 48.08%,
      #eaecef 48.08%,
      #eaecef 50%,
      #ffffff 50%,
      #ffffff 98.08%,
      #eaecef 98.08%,
      #eaecef 100%);
  background-size: 52px 52px;
  height: calc(100% - 23px);
}

.dark-theme .fake-lines {
  background-image: linear-gradient(0deg,
      #13171d 48.08%,
      #30363d 48.08%,
      #30363d 50%,
      #13171d 50%,
      #13171d 98.08%,
      #30363d 98.08%,
      #30363d 100%);
  background-size: 52px 52px;
}

.fake-lines.custom-list {
  height: calc(100% - 24px);
}

.todo-input {
  line-height: 1.3rem;
  width: 100%;
  border: none;
  font-size: 0.865rem;
}

.todo-input:focus {
  outline: none;
}

.loading-spinner {
  position: relative;
  margin: auto;
  top: 200px;
  height: 0px;
}

.todo-item-container {
  border-bottom: 1px solid #eaecef;
  height: 26px;
  z-index: 1;
  margin-bottom: -1px;
}
</style>
