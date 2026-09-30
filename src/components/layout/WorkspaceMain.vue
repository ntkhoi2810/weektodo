<template>
  <div class="workspace" :class="{ 'sidebar-visible': sidebarOpen, 'auto-hide': autoHideSidebar && isDesktop, 'day-view': viewMode === 'day', 'list-view': section === 'list' }">
    <div v-if="sidebarOpen" class="workspace-sidebar-scrim" @click="sidebarOpen = false"></div>
    <div v-if="autoHideSidebar && isDesktop && !sidebarOpen" class="workspace-sidebar-edge"
      aria-hidden="true" @pointerenter="openOnEdgeHover"></div>
    <workspace-sidebar :open="sidebarOpen" :selected-date="selectedDate" :selected-list-id="selectedListId"
      :active-section="section"
      :show-calendar="showCalendar" :show-custom-list="showCustomList"
      :auto-hide="autoHideSidebar" :desktop="isDesktop"
      @pointerenter="cancelHide" @pointerleave="scheduleHide" @focusout="onSidebarFocusOut"
      @toggle-auto-hide="toggleAutoHide"
      @change-date="selectDate" @select-list="selectList" @list-created="selectList" />
    <main class="workspace-main">
      <header class="workspace-header">
        <div class="workspace-heading">
          <button ref="sidebarToggle" type="button" class="workspace-icon-button" :aria-label="$t('ui.sidebar')" :aria-expanded="sidebarOpen" @click="toggleSidebar"><i class="bi-layout-sidebar-inset"></i></button>
          <div><h1>{{ heading }}</h1><p>{{ subheading }}</p></div>
        </div>
        <div class="workspace-controls">
          <div v-if="section === 'schedule'" class="workspace-nav">
            <button type="button" class="workspace-icon-button" :aria-label="$t('ui.previous')" @click="step(-1)"><i class="bi-chevron-left"></i></button>
            <button type="button" class="workspace-today-button" @click="selectDate(todayKey)">{{ $t('ui.today') }}</button>
            <button type="button" class="workspace-icon-button" :aria-label="$t('ui.next')" @click="step(1)"><i class="bi-chevron-right"></i></button>
          </div>
          <div v-if="section === 'schedule' && showCalendar" class="workspace-segment" role="group" :aria-label="$t('ui.view')">
            <button type="button" :class="{ active: viewMode === 'week' }" :aria-pressed="viewMode === 'week'" @click="viewMode = 'week'">{{ $t('ui.week') }}</button>
            <button type="button" :class="{ active: viewMode === 'day' }" :aria-pressed="viewMode === 'day'" @click="viewMode = 'day'">{{ $t('ui.day') }}</button>
            <button type="button" :class="{ active: viewMode === 'month' }" :aria-pressed="viewMode === 'month'" @click="viewMode = 'month'">{{ $t('ui.month') }}</button>
          </div>
          <button type="button" class="workspace-icon-button" :aria-label="$t('settings.darkTheme')" :aria-pressed="config.darkTheme" @click="toggleTheme"><i :class="config.darkTheme ? 'bi-sun' : 'bi-moon'"></i></button>
        </div>
      </header>
      <div class="workspace-board">
        <month-calendar v-if="section === 'schedule' && showCalendar && viewMode === 'month'"
          :selected-date="selectedDate || todayKey" :today-key="todayKey" @focus-day="focusDay" @open-task="openMonthTask" />
        <div v-else-if="section === 'schedule' && showCalendar" ref="weekListContainer" class="workspace-days" :style="dayWidthStyle">
          <to-do-list v-for="date in visibleDates" :key="date" :id="date" :show-custom-list="showCustomList"
            @todo-list-mounted="onTodoListMounted" @focus-day="focusDay" />
        </div>
        <custom-list-view v-else-if="section === 'list' && selectedListId" :key="selectedListId" :id="selectedListId" />
        <div v-else class="workspace-empty">
          <img src="/weektodo-icon-mono.svg" alt="WeekToDo" />
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import moment from "moment";
import WorkspaceSidebar from "./WorkspaceSidebar.vue";
import toDoList from "../toDoList.vue";
import CustomListView from "./CustomListView.vue";
import MonthCalendar from "./MonthCalendar.vue";
import configRepository from "../../repositories/configRepository";

export default {
  name: "WorkspaceMain",
  components: { WorkspaceSidebar, toDoList, CustomListView, MonthCalendar },
  props: { selectedDate: String },
  emits: ["change-date", "todo-list-mounted"],
  data() { return { viewMode: "week", section: this.$store.getters.config.calendar ? "schedule" : "list", sidebarOpen: !this.$store.getters.config.autoHideSidebar && window.innerWidth >= 1180, viewportWidth: window.innerWidth, hideTimer: null, selectedListId: null, todayKey: moment().format("YYYYMMDD"), pendingMonthTask: null }; },
  computed: {
    config() { return this.$store.getters.config; },
    autoHideSidebar() { return !!this.config.autoHideSidebar; },
    isDesktop() { return this.viewportWidth > 900; },
    showCalendar() { return this.config.calendar; },
    showCustomList() { return this.config.customList; },
    lists() { return this.$store.getters.cTodoListIds || []; },
    weekStart() {
      const date = moment(this.selectedDate || this.todayKey, "YYYYMMDD").startOf("day");
      const firstDay = this.config.weekStartOnMonday ? 1 : 0;
      return date.subtract((date.day() - firstDay + 7) % 7, "days");
    },
    weekDates() { return Array.from({ length: 7 }, (_, i) => this.weekStart.clone().add(i, "days").format("YYYYMMDD")); },
    visibleDates() { return this.viewMode === "day" ? [this.selectedDate || this.todayKey] : this.weekDates; },
    dayWidthStyle() { return { "--visible-days": this.viewMode === "day" ? 1 : Math.min(7, Math.max(1, Number(this.config.columns) || 5)) }; },
    heading() {
      if (this.section === "list") return this.lists.find(list => list.listId === this.selectedListId)?.listName || this.$t("todoDetails.todoLists");
      const date = moment(this.selectedDate || this.todayKey, "YYYYMMDD").locale(this.config.language);
      if (this.viewMode === "month") return date.format("MMMM YYYY");
      return this.viewMode === "day" ? date.format("dddd, D MMMM") : this.weekStart.clone().locale(this.config.language).format("MMMM YYYY");
    },
    subheading() {
      if (this.section === "list") return this.$t("todoDetails.independentList");
      if (this.viewMode === "month") return "";
      if (this.viewMode === "day") return moment(this.selectedDate || this.todayKey, "YYYYMMDD").locale(this.config.language).format("LL");
      const end = this.weekStart.clone().add(6, "days");
      return `${this.weekStart.clone().locale(this.config.language).format("D MMM")} – ${end.locale(this.config.language).format("D MMM YYYY")}`;
    },
  },
  watch: {
    lists: { immediate: true, deep: true, handler(lists) {
      if (!lists.some(list => list.listId === this.selectedListId)) this.selectedListId = lists[0] ? lists[0].listId : null;
      if (!this.selectedListId && this.showCalendar) this.section = "schedule";
    } },
    weekDates: { immediate: true, handler(dates) { this.$store.commit("updateSelectedDates", dates); } },
    showCalendar(value) { if (!value && this.showCustomList) this.section = "list"; else if (value && !this.showCustomList) this.section = "schedule"; },
    showCustomList(value) { if (!value && this.showCalendar) this.section = "schedule"; else if (value && !this.showCalendar) this.section = "list"; },
    autoHideSidebar(value) {
      this.cancelHide();
      if (this.isDesktop) this.sidebarOpen = !value;
    },
    isDesktop(value) {
      this.cancelHide();
      this.sidebarOpen = value && !this.autoHideSidebar && this.viewportWidth >= 1180;
    },
    selectedDate() { this.$nextTick(this.scrollToSelected); },
    viewMode() { this.$nextTick(this.scrollToSelected); },
  },
  mounted() {
    this.$nextTick(this.scrollToSelected);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
  },
  beforeUnmount() {
    this.cancelHide();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
  },
  methods: {
    onResize() { this.viewportWidth = window.innerWidth; },
    onKeyDown(event) {
      if (event.key === "Escape" && this.autoHideSidebar && this.isDesktop && this.sidebarOpen) {
        this.cancelHide();
        this.sidebarOpen = false;
        this.$refs.sidebarToggle.focus();
      }
    },
    toggleSidebar() {
      this.cancelHide();
      this.sidebarOpen = !this.sidebarOpen;
    },
    toggleAutoHide() {
      const enable = !this.autoHideSidebar;
      this.$store.commit("updateConfig", { key: "autoHideSidebar", val: enable });
      configRepository.update(this.config);
      if (enable) this.$nextTick(() => this.$refs.sidebarToggle.focus());
    },
    openOnEdgeHover(event) {
      if (event.pointerType === "mouse" || event.pointerType === "pen") {
        this.cancelHide();
        this.sidebarOpen = true;
      }
    },
    cancelHide() {
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = null;
    },
    scheduleHide() {
      if (!this.autoHideSidebar || !this.isDesktop) return;
      this.cancelHide();
      this.hideTimer = setTimeout(() => {
        const sidebar = this.$el.querySelector(".workspace-sidebar");
        if (!sidebar || !sidebar.contains(document.activeElement)) this.sidebarOpen = false;
        this.hideTimer = null;
      }, 220);
    },
    onSidebarFocusOut(event) {
      if (!this.autoHideSidebar || !this.isDesktop) return;
      if (!event.currentTarget.contains(event.relatedTarget)) this.scheduleHide();
    },
    step(direction) {
      const date = moment(this.selectedDate || this.todayKey, "YYYYMMDD");
      this.selectDate(this.viewMode === "month"
        ? date.startOf("month").add(direction, "months").format("YYYYMMDD")
        : date.add(direction * (this.viewMode === "week" ? 7 : 1), "days").format("YYYYMMDD"));
    },
    selectDate(date) { this.section = "schedule"; this.$emit("change-date", date); if (window.innerWidth <= 900) this.sidebarOpen = false; },
    focusDay(date) { this.viewMode = "day"; this.selectDate(date); },
    openMonthTask(entry) {
      if (entry.virtual) {
        this.pendingMonthTask = entry;
        this.focusDay(entry.listId);
        return;
      }
      const open = () => {
        const task = (this.$store.getters.todoLists[entry.listId] || [])[entry.index];
        if (task) this.showTask(task, entry.index);
      };
      if (this.$store.getters.todoLists[entry.listId]) open();
      else this.$store.dispatch("loadTodoLists", entry.listId).then(open);
    },
    onTodoListMounted(listId) {
      this.$emit("todo-list-mounted");
      const pending = this.pendingMonthTask;
      if (!pending || pending.listId !== listId) return;
      this.pendingMonthTask = null;
      const tasks = this.$store.getters.todoLists[listId] || [];
      let index = tasks.findIndex(task => task.repeatingEvent === pending.repeatingEventId && task.deadlineDate === pending.task.deadlineDate);
      if (index < 0) {
        const toDoListRepository = require("../../repositories/toDoListRepository").default;
        const repeatingEventByDateRepository = require("../../repositories/repeatingEventByDateRepository").default;
        const task = { ...pending.task };
        this.$store.commit("addTodo", task);
        index = tasks.length - 1;
        toDoListRepository.update(listId, tasks);
        const generated = this.$store.getters.repeatingEventByDate[listId] || {};
        generated[pending.repeatingEventId] = true;
        repeatingEventByDateRepository.update(listId, generated);
      }
      this.$nextTick(() => this.showTask(tasks[index], index));
    },
    showTask(task, index) {
      const { Modal } = require("bootstrap");
      this.$store.commit("actionsSelectedTodoIdUpdate", { toDo: task, index });
      Modal.getOrCreateInstance(document.getElementById("toDoModal"), { keyboard: false }).show();
    },
    selectList(id) { this.selectedListId = id; this.section = "list"; if (window.innerWidth <= 900) this.sidebarOpen = false; },
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
