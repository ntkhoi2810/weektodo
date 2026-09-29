<template>
  <div class="workspace" :class="{ 'sidebar-visible': sidebarOpen, 'day-view': viewMode === 'day', 'panel-open': panelOpen && showCustomList && lists.length }">
    <div v-if="sidebarOpen" class="workspace-sidebar-scrim" @click="sidebarOpen = false"></div>
    <workspace-sidebar :open="sidebarOpen" :selected-date="selectedDate" :selected-list-id="selectedListId"
      :show-calendar="showCalendar" :show-custom-list="showCustomList"
      @change-date="selectDate" @select-list="selectList" @list-created="selectList" />
    <main class="workspace-main">
      <header class="workspace-header">
        <div class="workspace-heading">
          <button type="button" class="workspace-icon-button" :aria-label="$t('ui.sidebar')" :aria-expanded="sidebarOpen" @click="sidebarOpen = !sidebarOpen"><i class="bi-layout-sidebar-inset"></i></button>
          <div><h1>{{ heading }}</h1><p>{{ subheading }}</p></div>
        </div>
        <div class="workspace-controls">
          <div class="workspace-nav">
            <button type="button" class="workspace-icon-button" :aria-label="$t('ui.previous')" @click="step(-1)"><i class="bi-chevron-left"></i></button>
            <button type="button" class="workspace-today-button" @click="selectDate(todayKey)">{{ $t('ui.today') }}</button>
            <button type="button" class="workspace-icon-button" :aria-label="$t('ui.next')" @click="step(1)"><i class="bi-chevron-right"></i></button>
          </div>
          <div v-if="showCalendar" class="workspace-segment" role="group" :aria-label="$t('ui.view')">
            <button type="button" :class="{ active: viewMode === 'week' }" :aria-pressed="viewMode === 'week'" @click="viewMode = 'week'">{{ $t('ui.week') }}</button>
            <button type="button" :class="{ active: viewMode === 'day' }" :aria-pressed="viewMode === 'day'" @click="viewMode = 'day'">{{ $t('ui.day') }}</button>
          </div>
          <button type="button" class="workspace-icon-button" :aria-label="$t('settings.darkTheme')" :aria-pressed="config.darkTheme" @click="toggleTheme"><i :class="config.darkTheme ? 'bi-sun' : 'bi-moon'"></i></button>
          <button v-if="showCustomList && lists.length" type="button" class="workspace-icon-button workspace-panel-toggle"
            :aria-label="$t('settings.customLists')" :aria-expanded="panelOpen" @click="panelOpen = !panelOpen"><i class="bi-layout-sidebar-inset-reverse"></i></button>
        </div>
      </header>
      <div class="workspace-board">
        <div v-if="showCalendar" ref="weekListContainer" class="workspace-days" :style="dayWidthStyle">
          <to-do-list v-for="date in visibleDates" :key="date" :id="date" :show-custom-list="showCustomList"
            @todo-list-mounted="$emit('todo-list-mounted')" @focus-day="focusDay" />
        </div>
        <div v-if="showCustomList && lists.length && panelOpen" class="workspace-list-panel">
          <div class="workspace-panel-heading">
            <div><p>{{ $t('settings.customLists') }} · {{ pendingCount }} {{ $t('ui.pending') }}</p></div>
            <button type="button" class="workspace-icon-button" :aria-label="$t('todoDetails.close')" @click="panelOpen = false"><i class="bi-x-lg"></i></button>
          </div>
          <to-do-list v-if="selectedListId" :key="selectedListId" :id="selectedListId" :custom-todo-list="true"
            :c-todo-list-index="selectedListIndex" :show-custom-list="showCustomList" @todo-list-mounted="$emit('todo-list-mounted')" />
        </div>
        <div v-if="!showCalendar && !(showCustomList && lists.length && panelOpen)" class="workspace-empty">
          <img src="/icon-mono.svg" alt="WeekToDo" />
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import moment from "moment";
import WorkspaceSidebar from "./WorkspaceSidebar.vue";
import toDoList from "../toDoList.vue";
import configRepository from "../../repositories/configRepository";

export default {
  name: "WorkspaceMain",
  components: { WorkspaceSidebar, toDoList },
  props: { selectedDate: String },
  emits: ["change-date", "todo-list-mounted"],
  data() { return { viewMode: "week", sidebarOpen: window.innerWidth >= 1180, panelOpen: window.innerWidth >= 1480 || !this.$store.getters.config.calendar, selectedListId: null, todayKey: moment().format("YYYYMMDD") }; },
  computed: {
    config() { return this.$store.getters.config; },
    showCalendar() { return this.config.calendar; },
    showCustomList() { return this.config.customList; },
    lists() { return this.$store.getters.cTodoListIds || []; },
    selectedListIndex() { return this.lists.findIndex(list => list.listId === this.selectedListId); },
    pendingCount() { return (this.$store.getters.todoLists[this.selectedListId] || []).filter(task => !task.checked).length; },
    weekStart() {
      const date = moment(this.selectedDate || this.todayKey, "YYYYMMDD").startOf("day");
      const firstDay = this.config.weekStartOnMonday ? 1 : 0;
      return date.subtract((date.day() - firstDay + 7) % 7, "days");
    },
    weekDates() { return Array.from({ length: 7 }, (_, i) => this.weekStart.clone().add(i, "days").format("YYYYMMDD")); },
    visibleDates() { return this.viewMode === "day" ? [this.selectedDate || this.todayKey] : this.weekDates; },
    dayWidthStyle() { return { "--visible-days": this.viewMode === "day" ? 1 : Math.min(7, Math.max(1, Number(this.config.columns) || 5)) }; },
    heading() {
      const date = moment(this.selectedDate || this.todayKey, "YYYYMMDD").locale(this.config.language);
      return this.viewMode === "day" ? date.format("dddd, D MMMM") : this.weekStart.clone().locale(this.config.language).format("MMMM YYYY");
    },
    subheading() {
      if (this.viewMode === "day") return moment(this.selectedDate || this.todayKey, "YYYYMMDD").locale(this.config.language).format("LL");
      const end = this.weekStart.clone().add(6, "days");
      return `${this.weekStart.clone().locale(this.config.language).format("D MMM")} – ${end.locale(this.config.language).format("D MMM YYYY")}`;
    },
  },
  watch: {
    lists: { immediate: true, deep: true, handler(lists) { if (!lists.some(list => list.listId === this.selectedListId)) this.selectedListId = lists[0] ? lists[0].listId : null; } },
    weekDates: { immediate: true, handler(dates) { this.$store.commit("updateSelectedDates", dates); } },
    showCalendar(value) { if (!value && this.showCustomList) this.panelOpen = true; },
    selectedDate() { this.$nextTick(this.scrollToSelected); },
    viewMode() { this.$nextTick(this.scrollToSelected); },
  },
  mounted() { this.$nextTick(this.scrollToSelected); },
  methods: {
    step(direction) { this.selectDate(moment(this.selectedDate || this.todayKey, "YYYYMMDD").add(direction * (this.viewMode === "week" ? 7 : 1), "days").format("YYYYMMDD")); },
    selectDate(date) { this.$emit("change-date", date); if (window.innerWidth <= 900) this.sidebarOpen = false; },
    focusDay(date) { this.viewMode = "day"; this.selectDate(date); },
    selectList(id) { this.selectedListId = id; this.panelOpen = true; if (window.innerWidth <= 900) this.sidebarOpen = false; },
    toggleTheme() {
      this.$store.commit("updateConfig", { key: "darkTheme", val: !this.config.darkTheme });
      configRepository.update(this.config);
    },
    scrollToSelected() {
      const container = this.$refs.weekListContainer;
      if (!container) return;
      const selected = container.querySelector(`#list${this.selectedDate}`);
      if (selected && this.viewMode === "week") container.scrollLeft = Math.max(0, selected.offsetLeft - container.offsetLeft - container.clientWidth / 2 + selected.clientWidth / 2);
      else container.scrollLeft = 0;
    },
    resetScroll() { this.$nextTick(this.scrollToSelected); },
  },
};
</script>
