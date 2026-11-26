<template>
  <aside class="workspace-sidebar" :class="{ open }" aria-label="WeekToDo sidebar" @dragleave="onSidebarDragLeave">
    <div class="workspace-brand"><img src="/weektodo-icon-mono.svg" alt="" /> <span>weektodo</span>
      <button v-if="desktop" type="button" class="workspace-sidebar-pin"
        :aria-label="$t(autoHide ? 'ui.pinSidebar' : 'ui.unpinSidebar')" :title="$t(autoHide ? 'ui.pinSidebar' : 'ui.unpinSidebar')"
        :aria-pressed="!autoHide" @click="$emit('toggle-auto-hide')">
        <i :class="autoHide ? 'bi-pin-angle' : 'bi-pin-angle-fill'" aria-hidden="true"></i>
      </button>
    </div>
    <button v-if="showCalendar" type="button" class="workspace-calendar-link" :class="{ selected: activeSection === 'schedule' }"
      @click="$emit('change-date', selectedDate)"><i class="bi-calendar-week"></i> {{ $t('settings.calendar') }}</button>
    <div v-if="showCalendar" class="mini-calendar">
      <div class="mini-calendar-heading">
        <strong>{{ monthLabel }}</strong>
        <div>
          <button type="button" :aria-label="$t('ui.previousMonth')" @click="shiftMonth(-1)"><i class="bi-chevron-left"></i></button>
          <button type="button" :aria-label="$t('ui.nextMonth')" @click="shiftMonth(1)"><i class="bi-chevron-right"></i></button>
        </div>
      </div>
      <div class="mini-calendar-grid">
        <span v-for="label in dayLabels" :key="label" class="mini-dow">{{ label }}</span>
        <button v-for="day in calendarDays" :key="day.key" type="button"
          :class="{ outside: day.outside, today: day.today, selected: day.selected, 'has-tasks': day.hasTasks, 'is-drop-target': dropTargetKey === 'day:' + day.key }"
          :aria-label="day.label" :aria-pressed="day.selected"
          @click="$emit('change-date', day.key)"
          @dragover.prevent="onDropZoneOver($event, 'day:' + day.key)"
          @dragenter.prevent="onDropZoneOver($event, 'day:' + day.key)"
          @dragleave="onDropZoneLeave($event, 'day:' + day.key)"
          @drop.prevent="onCalendarDrop($event, day)">{{ day.number }}</button>
      </div>
    </div>
    <nav v-if="showCustomList || showCalendar" class="workspace-lists" :aria-label="$t('todoDetails.todoLists')">
      <div class="workspace-section-title">{{ $t('todoDetails.todoLists') }}</div>
      <button type="button" class="workspace-list-link workspace-all-tasks-link"
        :class="{ selected: activeSection === 'all' }" :aria-pressed="activeSection === 'all'"
        @click="$emit('select-all')">
        <i class="bi-collection" aria-hidden="true"></i>
        <span class="workspace-list-name">{{ $t('allTasks.title') }}</span>
        <span v-if="allSummary.overdue > 0" class="workspace-overdue-badge" :title="$t('allTasks.overdue')">{{ allSummary.overdue }}</span>
        <span class="workspace-list-count">{{ allSummary.total }}</span>
      </button>
      <template v-if="showCustomList">
        <button v-for="list in lists" :key="list.listId" type="button" class="workspace-list-link"
          :class="{ selected: activeSection === 'list' && selectedListId === list.listId, 'is-drop-target': dropTargetKey === 'list:' + list.listId }"
          :aria-pressed="activeSection === 'list' && selectedListId === list.listId"
          @click="$emit('select-list', list.listId)"
          @dragover.prevent="onDropZoneOver($event, 'list:' + list.listId)"
          @dragenter.prevent="onDropZoneOver($event, 'list:' + list.listId)"
          @dragleave="onDropZoneLeave($event, 'list:' + list.listId)"
          @drop.prevent="onListDrop($event, list)">
          <span class="workspace-list-dot"></span><span class="workspace-list-name">{{ list.listName || $t('generatedData.list1') }}</span>
          <span class="workspace-list-count">{{ pending(list.listId) }}</span>
        </button>
        <button class="workspace-list-add" type="button" @click="newCustomTodoList"><i class="bi-plus-lg"></i> {{ $t('ui.newCustomList') }}</button>
      </template>
    </nav>
    <div class="workspace-sidebar-bottom">
      <button type="button" data-bs-toggle="modal" data-bs-target="#RecurrentEventsModal"><i class="bi-arrow-repeat"></i><span>{{ $t('ui.recurringTasks') }}</span></button>
      <button type="button" data-bs-toggle="modal" data-bs-target="#ReorderCustomListsModal"><i class="bi-arrow-left-right"></i><span>{{ $t('ui.reorderCustomLists') }}</span></button>
      <button type="button" data-bs-toggle="modal" data-bs-target="#tipsModal"><i class="bi-info-circle"></i><span>{{ $t('tips.tips') }}</span></button>
      <button type="button" data-bs-toggle="modal" data-bs-target="#aboutModal"><i class="bi-info-square"></i><span>{{ $t('about.about') }}</span></button>
      <a href="https://weektodo.me/support-us" target="_blank" rel="noopener noreferrer"><i class="bi-gift"></i><span>{{ $t('donate.supportUs') }}</span></a>
      <button type="button" data-bs-toggle="modal" data-bs-target="#configModal" @click="openConfigModal"><i class="bi-gear"></i><span>{{ $t('settings.settings') }}</span></button>
      <button type="button" @click="print"><i class="bi-printer"></i><span>{{ $t('ui.print') }}</span></button>
      <p><i class="bi-lock"></i> {{ $t('ui.localData') }}</p>
    </div>
  </aside>
</template>

<script>
import moment from "moment";
import customToDoListIdsRepository from "../../repositories/customToDoListIdsRepository";
import toDoListRepository from "../../repositories/toDoListRepository";
import { collectAllTasks, computeTaskSummary } from "../../helpers/allTasks";
import { buildMovePatch, clearDragPayload, getDragPayload, isTaskDragEvent } from "../../helpers/taskOperations";
import { moveTaskWithFeedback } from "../../helpers/taskActions";

export default {
  name: "WorkspaceSidebar",
  props: {
    open: Boolean,
    selectedDate: String,
    selectedListId: String,
    activeSection: String,
    showCalendar: Boolean,
    showCustomList: Boolean,
    autoHide: Boolean,
    desktop: Boolean,
  },
  emits: ["change-date", "select-list", "select-all", "list-created", "toggle-auto-hide"],
  data() { return { calendarMonth: moment().startOf("month"), dropTargetKey: null }; },
  computed: {
    lists() { return this.$store.getters.cTodoListIds || []; },
    allSummary() {
      const entries = collectAllTasks(this.$store.getters.todoLists, this.lists, { now: moment() })
        .filter(entry => (entry.sourceType === "custom" ? this.showCustomList : this.showCalendar));
      return computeTaskSummary(entries);
    },
    monthLabel() { return this.calendarMonth.clone().locale(this.$store.getters.config.language).format("MMMM YYYY"); },
    dayLabels() {
      const base = moment().startOf("day");
      const firstDay = this.$store.getters.config.weekStartOnMonday ? 1 : 0;
      base.subtract((base.day() - firstDay + 7) % 7, "days");
      return Array.from({ length: 7 }, (_, i) => base.clone().add(i, "days").locale(this.$store.getters.config.language).format("dd"));
    },
    calendarDays() {
      const monday = this.$store.getters.config.weekStartOnMonday;
      const start = this.calendarMonth.clone().startOf("month");
      start.subtract((start.day() - (monday ? 1 : 0) + 7) % 7, "days");
      const tasks = this.$store.getters.todoLists;
      return Array.from({ length: 42 }, (_, i) => {
        const date = start.clone().add(i, "days");
        const key = date.format("YYYYMMDD");
        return { key, number: date.date(), label: date.locale(this.$store.getters.config.language).format("LL"),
          outside: !date.isSame(this.calendarMonth, "month"), today: date.isSame(moment(), "day"),
          selected: key === this.selectedDate, hasTasks: !!(tasks[key] && tasks[key].length) };
      });
    },
  },
  watch: { selectedDate(value) { if (value) this.calendarMonth = moment(value, "YYYYMMDD").startOf("month"); } },
  mounted() {
    this.$store.dispatch("loadAllTodoLists").then(() => {
      this.lists.forEach(list => {
        if (!this.$store.getters.todoLists[list.listId]) this.$store.dispatch("loadTodoLists", list.listId);
      });
    });
  },
  methods: {
    shiftMonth(offset) { this.calendarMonth = this.calendarMonth.clone().add(offset, "months"); },
    pending(id) { return (this.$store.getters.todoLists[id] || []).filter(task => !task.checked).length; },
    newCustomTodoList() {
      const list = { listId: moment().format("YYYYMMDDTHHmmssS"), listName: "" };
      this.$store.commit("actionsCListCreatedUpdate", true);
      this.$store.commit("newCustomTodoList", list);
      customToDoListIdsRepository.update(this.$store.getters.cTodoListIds);
      toDoListRepository.update(list.listId, this.$store.getters.todoLists[list.listId]);
      this.$emit("list-created", list.listId);
    },
    openConfigModal() { document.getElementById("config-general-tab").click(); },
    print() { window.print(); },
    onSidebarDragLeave(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.dropTargetKey = null;
      }
    },
    onDropZoneOver(event, key) {
      if (!isTaskDragEvent(event)) return;
      this.dropTargetKey = key;
    },
    onDropZoneLeave(event, key) {
      if (!event.currentTarget.contains(event.relatedTarget) && this.dropTargetKey === key) {
        this.dropTargetKey = null;
      }
    },
    async onCalendarDrop(event, day) {
      this.dropTargetKey = null;
      const payload = getDragPayload(event);
      clearDragPayload();
      if (!payload || payload.listId === day.key) return;
      const patch = buildMovePatch(payload.toDo, day.key);
      const label = day.today ? this.$t("ui.today") : moment(day.key, "YYYYMMDD", true).locale(this.$store.getters.config.language).format("D MMM");
      await moveTaskWithFeedback(this, {
        fromListId: payload.listId,
        fromIndex: payload.index,
        toListId: day.key,
        toIndex: null,
        patch,
        showUndoToast: true,
        toastMessage: this.$t("quickMove.movedTo", { target: label }),
      });
    },
    async onListDrop(event, list) {
      this.dropTargetKey = null;
      const payload = getDragPayload(event);
      clearDragPayload();
      if (!payload || payload.listId === list.listId) return;
      const label = list.listName || this.$t("generatedData.list1");
      await moveTaskWithFeedback(this, {
        fromListId: payload.listId,
        fromIndex: payload.index,
        toListId: list.listId,
        toIndex: null,
        showUndoToast: true,
        toastMessage: this.$t("quickMove.movedTo", { target: label }),
      });
    },
  },
};
</script>
