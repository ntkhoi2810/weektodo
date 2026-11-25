<template>
  <div class="board-task" :class="{ done: toDo.checked, 'has-color': toDo.color && toDo.color !== 'none', 'is-overdue': overdue }"
    :style="toDo.color && toDo.color !== 'none' ? { '--task-color': toDo.color } : {}"
    :draggable="!isTouch" @dragstart="startDrag" @dragend="endDrag">
    <button type="button" class="board-task-check" :aria-label="toDo.checked ? $t('ui.markIncomplete') : $t('ui.markComplete')"
      :aria-pressed="toDo.checked" @click.stop="toggleDone">
      <i :class="toDo.checked ? 'bi-check-circle-fill' : 'bi-circle'"></i>
    </button>
    <div class="board-task-content" role="button" tabindex="0" @click="openDetails" @keydown.enter="openDetails" @keydown.space.prevent="openDetails">
      <span class="board-task-title" v-html="todoText"></span>
      <span v-if="hasMeta" class="board-task-meta">
        <span v-if="toDo.deadlineDate" :class="{ 'meta-overdue': overdue }"><i class="bi-calendar-event"></i> {{ dateFormat(toDo.deadlineDate) }}</span>
        <span v-if="toDo.deadlineTime" :class="{ 'meta-overdue': overdue }"><i class="bi-clock"></i> {{ toDo.deadlineTime }}</span>
        <span v-if="overdue && !toDo.deadlineDate" class="meta-overdue"><i class="bi-exclamation-circle"></i> {{ $t('allTasks.overdue') }}</span>
        <span v-if="toDo.subTaskList && toDo.subTaskList.length"><i class="bi-list-check"></i> {{ completedSubtasks }}/{{ toDo.subTaskList.length }}</span>
        <span v-if="toDo.alarm && notificationIndicator"><i class="bi-bell"></i></span>
        <button v-if="sourceLabel" type="button" class="task-source-pill" @click.stop="$emit('open-source')">
          <i :class="sourceType === 'calendar' ? 'bi-calendar3' : 'bi-list-ul'" aria-hidden="true"></i>
          <span>{{ sourceLabel }}</span>
        </button>
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
import { isTaskOverdue } from "../helpers/deadline";
import linkifyStr from "linkify-string";

export default {
  emits: ["open-source"],
  props: {
    toDo: { required: true, type: Object },
    index: { required: true, type: Number },
    toDoListId: { required: true, type: String },
    sourceLabel: { required: false, default: "", type: String },
    sourceType: { required: false, default: "", type: String },
    isOverdue: { required: false, default: null, type: Boolean },
  },
  data() { return { isTouch: window.matchMedia("(pointer: coarse)").matches }; },
  computed: {
    notificationIndicator() { return this.$store.getters.config.notificationIndicator; },
    completedSubtasks() { return (this.toDo.subTaskList || []).filter(task => task.checked).length; },
    todoText() { return linkifyStr(this.toDo.text, { target: "_blank", defaultProtocol: "https" }); },
    overdue() {
      if (this.toDo.checked) return false;
      if (this.isOverdue !== null) return this.isOverdue;
      return isTaskOverdue(this.toDo);
    },
    hasMeta() {
      return !!(this.toDo.deadlineDate || this.toDo.deadlineTime || this.overdue ||
        (this.toDo.subTaskList && this.toDo.subTaskList.length) || this.toDo.alarm || this.sourceLabel);
    },
  },
  methods: {
    dateFormat(date) { return moment(date, "YYYY-MM-DD").locale(this.$store.getters.config.language).format("D MMM"); },
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
