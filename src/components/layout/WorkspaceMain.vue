<template>
  <div class="workspace" :class="{ 'sidebar-visible': sidebarOpen, 'day-view': viewMode === 'day', 'list-view': section === 'list' }">
    <div v-if="sidebarOpen" class="workspace-sidebar-scrim" @click="sidebarOpen = false"></div>
    <workspace-sidebar :open="sidebarOpen" :selected-date="selectedDate" :selected-list-id="selectedListId"
      :active-section="section"
      :show-calendar="showCalendar" :show-custom-list="showCustomList"
      @change-date="selectDate" @select-list="selectList" @list-created="selectList" />
    <main class="workspace-main">
      <header class="workspace-header">
        <div class="workspace-heading">
          <button type="button" class="workspace-icon-button" :aria-label="$t('ui.sidebar')" :aria-expanded="sidebarOpen" @click="sidebarOpen = !sidebarOpen"><i class="bi-layout-sidebar-inset"></i></button>
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
          </div>
          <button type="button" class="workspace-icon-button" :aria-label="$t('settings.darkTheme')" :aria-pressed="config.darkTheme" @click="toggleTheme"><i :class="config.darkTheme ? 'bi-sun' : 'bi-moon'"></i></button>
        </div>
      </header>
      <div class="workspace-board">
        <div v-if="section === 'schedule' && showCalendar" ref="weekListContainer" class="workspace-days" :style="dayWidthStyle">
          <to-do-list v-for="date in visibleDates" :key="date" :id="date" :show-custom-list="showCustomList"
            @todo-list-mounted="$emit('todo-list-mounted')" @focus-day="focusDay" />
        </div>
        <custom-list-view v-else-if="section === 'list' && selectedListId" :key="selectedListId" :id="selectedListId" />
        <div v-else class="workspace-empty">
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
import CustomListView from "./CustomListView.vue";
import configRepository from "../../repositories/configRepository";

export default {
  name: "WorkspaceMain",
  components: { WorkspaceSidebar, toDoList, CustomListView },
  props: { selectedDate: String },
  emits: ["change-date", "todo-list-mounted"],
  data() { return { viewMode: "week", section: this.$store.getters.config.calendar ? "schedule" : "list", sidebarOpen: window.innerWidth >= 1180, selectedListId: null, todayKey: moment().format("YYYYMMDD") }; },
  computed: {
    config() { return this.$store.getters.config; },
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
      return this.viewMode === "day" ? date.format("dddd, D MMMM") : this.weekStart.clone().locale(this.config.language).format("MMMM YYYY");
    },
    subheading() {
      if (this.section === "list") return this.$t("todoDetails.independentList");
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
    selectedDate() { this.$nextTick(this.scrollToSelected); },
    viewMode() { this.$nextTick(this.scrollToSelected); },
  },
  mounted() { this.$nextTick(this.scrollToSelected); },
  methods: {
    step(direction) { this.selectDate(moment(this.selectedDate || this.todayKey, "YYYYMMDD").add(direction * (this.viewMode === "week" ? 7 : 1), "days").format("YYYYMMDD")); },
    selectDate(date) { this.section = "schedule"; this.$emit("change-date", date); if (window.innerWidth <= 900) this.sidebarOpen = false; },
    focusDay(date) { this.viewMode = "day"; this.selectDate(date); },
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
