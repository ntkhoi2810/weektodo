<template>
  <aside class="workspace-sidebar" :class="{ open }" aria-label="WeekToDo sidebar">
    <div class="workspace-brand"><img src="/icon-mono.svg" alt="" /> <span>weektodo</span></div>
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
          :class="{ outside: day.outside, today: day.today, selected: day.selected, 'has-tasks': day.hasTasks }"
          :aria-label="day.label" :aria-pressed="day.selected" @click="$emit('change-date', day.key)">{{ day.number }}</button>
      </div>
    </div>
    <nav v-if="showCustomList" class="workspace-lists" :aria-label="$t('settings.customLists')">
      <div class="workspace-section-title">{{ $t('settings.customLists') }}</div>
      <button v-for="list in lists" :key="list.listId" type="button" class="workspace-list-link"
        :class="{ selected: selectedListId === list.listId }" :aria-pressed="selectedListId === list.listId"
        @click="$emit('select-list', list.listId)">
        <span class="workspace-list-dot"></span><span class="workspace-list-name">{{ list.listName || $t('generatedData.list1') }}</span>
        <span class="workspace-list-count">{{ pending(list.listId) }}</span>
      </button>
      <button class="workspace-list-add" type="button" @click="newCustomTodoList"><i class="bi-plus-lg"></i> {{ $t('ui.newCustomList') }}</button>
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

export default {
  name: "WorkspaceSidebar",
  props: {
    open: Boolean,
    selectedDate: String,
    selectedListId: String,
    showCalendar: Boolean,
    showCustomList: Boolean,
  },
  emits: ["change-date", "select-list", "list-created"],
  data() { return { calendarMonth: moment().startOf("month") }; },
  computed: {
    lists() { return this.$store.getters.cTodoListIds || []; },
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
    this.lists.forEach(list => {
      if (!this.$store.getters.todoLists[list.listId]) this.$store.dispatch("loadTodoLists", list.listId);
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
  },
};
</script>
