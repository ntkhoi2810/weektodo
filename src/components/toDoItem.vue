<template>
  <div class="board-task" :class="{ done: toDo.checked, 'has-color': toDo.color && toDo.color !== 'none' }"
    :style="toDo.color && toDo.color !== 'none' ? { '--task-color': toDo.color } : {}"
    :draggable="!isTouch" @dragstart="startDrag" @dragend="endDrag">
    <button type="button" class="board-task-check" :aria-label="toDo.checked ? $t('ui.markIncomplete') : $t('ui.markComplete')"
      :aria-pressed="toDo.checked" @click.stop="toggleDone">
      <i :class="toDo.checked ? 'bi-check-circle-fill' : 'bi-circle'"></i>
    </button>
    <div class="board-task-content" role="button" tabindex="0" @click="openDetails" @keydown.enter="openDetails" @keydown.space.prevent="openDetails">
      <span class="board-task-title" v-html="todoText"></span>
      <span v-if="toDo.time || (toDo.subTaskList && toDo.subTaskList.length) || toDo.alarm" class="board-task-meta">
        <span v-if="toDo.time"><i class="bi-clock"></i> {{ timeFormat(toDo.time) }}</span>
        <span v-if="toDo.subTaskList && toDo.subTaskList.length"><i class="bi-list-check"></i> {{ completedSubtasks }}/{{ toDo.subTaskList.length }}</span>
        <span v-if="toDo.alarm && notificationIndicator"><i class="bi-bell"></i></span>
      </span>
    </div>
    <button type="button" class="board-task-more" :aria-label="$t('todoDetails.actions')" @click.stop="openDetails"><i class="bi-three-dots"></i></button>
  </div>
</template>

<script>
import { Modal } from "bootstrap";
import moment from "moment";
import toDoListRepository from "../repositories/toDoListRepository";
import notifications from "../helpers/notifications";
import tasksHelper from "../helpers/tasksHelper";
import linkifyStr from "linkify-string";

export default {
  props: {
    toDo: { required: true, type: Object },
    index: { required: true, type: Number },
    toDoListId: { required: true, type: String },
  },
  data() { return { isTouch: window.matchMedia("(pointer: coarse)").matches }; },
  computed: {
    notificationIndicator() { return this.$store.getters.config.notificationIndicator; },
    completedSubtasks() { return (this.toDo.subTaskList || []).filter(task => task.checked).length; },
    todoText() { return linkifyStr(this.toDo.text, { target: "_blank", defaultProtocol: "https" }); },
  },
  methods: {
    timeFormat(time) { return moment(time, "HH:mm").format("HH:mm"); },
    persist() {
      let list = this.$store.getters.todoLists[this.toDoListId];
      if (this.$store.getters.config.autoReorderTasks) list = tasksHelper.reorderTasksList(list);
      toDoListRepository.update(this.toDoListId, list);
      notifications.refreshDayNotifications(this, this.toDoListId);
    },
    toggleDone() {
      this.$store.commit("checkTodo", { toDoListId: this.toDoListId, index: this.index });
      if (this.toDo.checked && this.$store.getters.config.moveCompletedTaskToBottom) {
        this.$store.commit("moveTodoToEnd", { toDoListId: this.toDoListId, index: this.index });
      }
      this.persist();
    },
    openDetails(event) {
      if (event && event.target && event.target.closest && event.target.closest("a")) return;
      this.$store.commit("actionsSelectedTodoIdUpdate", { toDo: this.toDo, index: this.index });
      const element = document.getElementById("toDoModal");
      Modal.getOrCreateInstance(element, { keyboard: false }).show();
    },
    startDrag(event) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("item", JSON.stringify(this.toDo));
      event.dataTransfer.setData("index", this.index);
      document.getElementById("app-container").classList.add("dragging-item");
    },
    endDrag() { document.getElementById("app-container").classList.remove("dragging-item"); },
  },
};
</script>
