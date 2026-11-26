<template>
  <div class="board-task"
    :class="{
      done: toDo.checked,
      'has-color': toDo.color && toDo.color !== 'none',
      'is-overdue': overdue,
      'is-dragging': dragging,
      'drop-before': dropPosition === 'before',
      'drop-after': dropPosition === 'after',
    }"
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
    <button v-if="canQuickMove" ref="moveTrigger" type="button" class="board-task-move"
      :aria-label="$t('quickMove.title')" :title="$t('quickMove.title')" :aria-expanded="moveMenuOpen"
      @click.stop="toggleMoveMenu">
      <i class="bi-arrow-right-circle"></i>
    </button>
    <button type="button" class="board-task-more" :aria-label="$t('todoDetails.actions')" @click.stop="openDetails"><i class="bi-three-dots"></i></button>

    <teleport to="#app-container">
      <div v-if="moveMenuOpen" ref="moveMenu" class="quick-move-popover" :style="moveMenuStyle"
        role="dialog" :aria-label="$t('quickMove.title')" @click.stop @wheel.stop>
        <div class="quick-move-header">{{ $t('quickMove.moveTo') }}</div>
        <div class="quick-move-body">
          <div v-if="showCalendar" class="quick-move-section">
            <div class="quick-move-section-title">{{ $t('settings.calendar') }}</div>
            <button type="button" class="quick-move-item" :disabled="toDoListId === todayKey"
              @click="moveToTarget(todayKey, $t('ui.today'))">
              <i class="bi-sun" aria-hidden="true"></i>
              <span>{{ $t('ui.today') }}</span>
              <i v-if="toDoListId === todayKey" class="bi-check2 quick-move-current"></i>
            </button>
            <button type="button" class="quick-move-item" :disabled="toDoListId === tomorrowKey"
              @click="moveToTarget(tomorrowKey, $t('allTasks.tomorrow'))">
              <i class="bi-sunrise" aria-hidden="true"></i>
              <span>{{ $t('allTasks.tomorrow') }}</span>
              <i v-if="toDoListId === tomorrowKey" class="bi-check2 quick-move-current"></i>
            </button>
            <button type="button" class="quick-move-item" :disabled="toDoListId === nextWeekKey"
              @click="moveToTarget(nextWeekKey, $t('quickMove.nextWeek'))">
              <i class="bi-calendar-range" aria-hidden="true"></i>
              <span>{{ $t('quickMove.nextWeek') }}</span>
              <i v-if="toDoListId === nextWeekKey" class="bi-check2 quick-move-current"></i>
            </button>
            <div class="quick-move-date-wrap">
              <button type="button" class="quick-move-item quick-move-date-btn"
                :class="{ active: showMoveCalendar }"
                :aria-expanded="showMoveCalendar"
                @click="toggleMoveCalendar">
                <i class="bi-calendar-plus" aria-hidden="true"></i>
                <span>{{ $t('quickMove.pickDate') }}</span>
                <i :class="showMoveCalendar ? 'bi-chevron-up' : 'bi-chevron-down'" class="quick-move-caret" aria-hidden="true"></i>
              </button>
              <date-picker-popover
                v-if="showMoveCalendar"
                :inline="true"
                :model-value="currentTaskIsoDate"
                :show-presets="false"
                :show-footer="false"
                :allow-clear="false"
                @select="moveToPickedDate" />
            </div>
          </div>
          <div v-if="showCustomList && customLists.length" class="quick-move-section">
            <div class="quick-move-section-title">{{ $t('todoDetails.todoLists') }}</div>
            <div v-if="customLists.length >= 5" class="quick-move-filter">
              <input v-model="listFilterQuery" type="text" class="quick-move-filter-input"
                :placeholder="$t('allTasks.searchPlaceholder')" @keydown.stop />
            </div>
            <button v-for="list in filteredCustomLists" :key="list.listId" type="button" class="quick-move-item"
              :disabled="list.listId === toDoListId"
              @click="moveToTarget(list.listId, list.listName || $t('generatedData.list1'))">
              <span class="quick-move-dot" aria-hidden="true"></span>
              <span class="quick-move-name">{{ list.listName || $t('generatedData.list1') }}</span>
              <i v-if="list.listId === toDoListId" class="bi-check2 quick-move-current"></i>
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import { Modal } from "bootstrap";
import moment from "moment";
import toDoListRepository from "../repositories/toDoListRepository";
import notifications from "../helpers/notifications";
import tasksHelper from "../helpers/tasksHelper";
import { isTaskOverdue } from "../helpers/deadline";
import { buildMovePatch, clearDragPayload, computeNextWeekListId, isCalendarListId, setDragPayload } from "../helpers/taskOperations";
import { moveTaskWithFeedback } from "../helpers/taskActions";
import DatePickerPopover from "./DatePickerPopover.vue";
import linkifyStr from "linkify-string";

export default {
  components: { DatePickerPopover },
  emits: ["open-source"],
  props: {
    toDo: { required: true, type: Object },
    index: { required: true, type: Number },
    toDoListId: { required: true, type: String },
    sourceLabel: { required: false, default: "", type: String },
    sourceType: { required: false, default: "", type: String },
    isOverdue: { required: false, default: null, type: Boolean },
    dropPosition: { required: false, default: "", type: String },
  },
  data() {
    return {
      isTouch: window.matchMedia("(hover: none) and (pointer: coarse)").matches,
      dragging: false,
      moveMenuOpen: false,
      moveMenuStyle: {},
      showMoveCalendar: false,
      listFilterQuery: "",
    };
  },
  computed: {
    config() { return this.$store.getters.config; },
    showCalendar() { return !!this.config.calendar; },
    showCustomList() { return !!this.config.customList; },
    customLists() { return this.$store.getters.cTodoListIds || []; },
    currentTaskIsoDate() {
      if (this.toDo.deadlineDate) return this.toDo.deadlineDate;
      if (isCalendarListId(this.toDoListId)) return moment(this.toDoListId, "YYYYMMDD", true).format("YYYY-MM-DD");
      return null;
    },
    filteredCustomLists() {
      const q = (this.listFilterQuery || "").trim().toLowerCase();
      if (!q) return this.customLists;
      return this.customLists.filter(list => (list.listName || this.$t("generatedData.list1")).toLowerCase().includes(q));
    },
    canQuickMove() { return this.showCalendar || (this.showCustomList && this.customLists.length > 0); },
    todayKey() { return moment().format("YYYYMMDD"); },
    tomorrowKey() { return moment().add(1, "day").format("YYYYMMDD"); },
    nextWeekKey() { return computeNextWeekListId({ weekStartOnMonday: this.config.weekStartOnMonday }); },
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
  watch: {
    toDo() {
      this.dragging = false;
      this.closeMoveMenu();
    },
    index() {
      this.dragging = false;
    },
  },
  beforeUnmount() {
    this.detachMenuListeners();
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
      this.closeMoveMenu();
      this.$store.commit("actionsSelectedTodoIdUpdate", { toDo: this.toDo, index: this.index });
      const element = document.getElementById("toDoModal");
      Modal.getOrCreateInstance(element, { keyboard: false }).show();
    },
    toggleMoveMenu(event) {
      if (this.moveMenuOpen) {
        this.closeMoveMenu();
        return;
      }
      this.showMoveCalendar = false;
      this.listFilterQuery = "";
      const trigger = event.currentTarget || this.$refs.moveTrigger;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 252;
      const estimatedHeight = 360;
      const left = Math.max(10, Math.min(window.innerWidth - menuWidth - 10, rect.right - menuWidth));
      const openAbove = rect.bottom + estimatedHeight > window.innerHeight - 10 && rect.top > estimatedHeight;
      this.moveMenuStyle = openAbove
        ? { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 6}px`, top: "auto" }
        : { left: `${left}px`, top: `${Math.max(10, Math.min(window.innerHeight - 120, rect.bottom + 6))}px`, bottom: "auto" };
      this.moveMenuOpen = true;
      this.$nextTick(() => {
        this.repositionMoveMenu();
        this.attachMenuListeners();
      });
    },
    repositionMoveMenu() {
      const menuEl = this.$refs.moveMenu;
      const trigger = this.$refs.moveTrigger;
      if (!menuEl || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 252;
      const left = Math.max(10, Math.min(window.innerWidth - menuWidth - 10, rect.right - menuWidth));
      const actualHeight = menuEl.offsetHeight;
      if (rect.bottom + actualHeight + 12 > window.innerHeight) {
        if (rect.top > actualHeight + 12) {
          this.moveMenuStyle = { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 6}px`, top: "auto" };
        } else {
          this.moveMenuStyle = { left: `${left}px`, top: `${Math.max(10, window.innerHeight - actualHeight - 10)}px`, bottom: "auto" };
        }
      } else {
        this.moveMenuStyle = { left: `${left}px`, top: `${rect.bottom + 6}px`, bottom: "auto" };
      }
    },
    closeMoveMenu() {
      if (!this.moveMenuOpen) return;
      this.moveMenuOpen = false;
      this.showMoveCalendar = false;
      this.detachMenuListeners();
    },
    attachMenuListeners() {
      document.addEventListener("pointerdown", this.onMenuOutsideClick);
      document.addEventListener("keydown", this.onMenuKeyDown);
      window.addEventListener("scroll", this.onWindowScroll, true);
      window.addEventListener("resize", this.closeMoveMenu);
    },
    detachMenuListeners() {
      document.removeEventListener("pointerdown", this.onMenuOutsideClick);
      document.removeEventListener("keydown", this.onMenuKeyDown);
      window.removeEventListener("scroll", this.onWindowScroll, true);
      window.removeEventListener("resize", this.closeMoveMenu);
    },
    onWindowScroll(event) {
      const menu = this.$refs.moveMenu;
      if (menu && (event.target === menu || menu.contains(event.target))) return;
      this.closeMoveMenu();
    },
    onMenuOutsideClick(event) {
      const menu = this.$refs.moveMenu;
      const trigger = this.$refs.moveTrigger;
      if ((menu && menu.contains(event.target)) || (trigger && trigger.contains(event.target))) return;
      this.closeMoveMenu();
    },
    onMenuKeyDown(event) {
      if (event.key === "Escape") this.closeMoveMenu();
    },
    toggleMoveCalendar() {
      this.showMoveCalendar = !this.showMoveCalendar;
      this.$nextTick(() => this.repositionMoveMenu());
    },
    async moveToTarget(targetListId, targetLabel) {
      if (!targetListId || targetListId === this.toDoListId) return;
      this.closeMoveMenu();
      const patch = buildMovePatch(this.toDo, targetListId);
      await moveTaskWithFeedback(this, {
        fromListId: this.toDoListId,
        fromIndex: this.index,
        toListId: targetListId,
        toIndex: null,
        patch,
        showUndoToast: true,
        toastMessage: this.$t("quickMove.movedTo", { target: targetLabel }),
      });
    },
    moveToPickedDate(isoDate) {
      if (!isoDate) return;
      const target = moment(isoDate, "YYYY-MM-DD", true);
      if (!target.isValid()) return;
      const targetListId = target.format("YYYYMMDD");
      const label = target.clone().locale(this.config.language).format("D MMM");
      this.moveToTarget(targetListId, label);
    },
    startDrag(event) {
      this.closeMoveMenu();
      this.dragging = true;
      setDragPayload(event, { toDo: this.toDo, index: this.index, listId: this.toDoListId });
      const appContainer = document.getElementById("app-container");
      if (appContainer) appContainer.classList.add("dragging-item");
    },
    endDrag() {
      this.dragging = false;
      clearDragPayload();
      const appContainer = document.getElementById("app-container");
      if (appContainer) appContainer.classList.remove("dragging-item");
    },
  },
};
</script>
