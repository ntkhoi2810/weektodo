<template>
  <section class="all-tasks-view" :aria-label="$t('allTasks.title')">
    <div class="all-tasks-summary" role="group" :aria-label="$t('allTasks.summary')">
      <button type="button" class="summary-chip" :class="{ active: bucketFilter === 'all' }"
        :aria-pressed="bucketFilter === 'all'" @click="bucketFilter = 'all'">
        <span class="summary-chip-label">{{ $t('allTasks.all') }}</span>
        <strong class="summary-chip-count">{{ summary.total }}</strong>
      </button>
      <button type="button" class="summary-chip is-danger" :class="{ active: bucketFilter === 'overdue', 'has-overdue': summary.overdue > 0 }"
        :aria-pressed="bucketFilter === 'overdue'" @click="bucketFilter = bucketFilter === 'overdue' ? 'all' : 'overdue'">
        <span class="summary-chip-label">{{ $t('allTasks.overdue') }}</span>
        <strong class="summary-chip-count">{{ summary.overdue }}</strong>
      </button>
      <button type="button" class="summary-chip" :class="{ active: bucketFilter === 'today' }"
        :aria-pressed="bucketFilter === 'today'" @click="bucketFilter = bucketFilter === 'today' ? 'all' : 'today'">
        <span class="summary-chip-label">{{ $t('ui.today') }}</span>
        <strong class="summary-chip-count">{{ summary.today }}</strong>
      </button>
      <button type="button" class="summary-chip" :class="{ active: bucketFilter === 'upcoming' }"
        :aria-pressed="bucketFilter === 'upcoming'" @click="bucketFilter = bucketFilter === 'upcoming' ? 'all' : 'upcoming'">
        <span class="summary-chip-label">{{ $t('allTasks.upcoming') }}</span>
        <strong class="summary-chip-count">{{ summary.upcoming }}</strong>
      </button>
      <button type="button" class="summary-chip" :class="{ active: bucketFilter === 'noDeadline' }"
        :aria-pressed="bucketFilter === 'noDeadline'" @click="bucketFilter = bucketFilter === 'noDeadline' ? 'all' : 'noDeadline'">
        <span class="summary-chip-label">{{ $t('todoDetails.noDeadline') }}</span>
        <strong class="summary-chip-count">{{ summary.noDeadline }}</strong>
      </button>
    </div>

    <div class="all-tasks-toolbar">
      <div class="all-tasks-search">
        <i class="bi-search" aria-hidden="true"></i>
        <input v-model="searchQuery" type="text" :placeholder="$t('allTasks.searchPlaceholder')"
          :aria-label="$t('allTasks.searchPlaceholder')" @keydown.esc="searchQuery = ''" />
        <button v-if="searchQuery" type="button" class="all-tasks-search-clear" :aria-label="$t('ui.clear')" @click="searchQuery = ''">
          <i class="bi-x"></i>
        </button>
      </div>

      <select v-model="sourceFilter" class="all-tasks-select" :aria-label="$t('allTasks.filterBySource')">
        <option value="all">{{ $t('allTasks.allSources') }}</option>
        <option v-if="showCustomList" value="custom">{{ $t('allTasks.customListsOnly') }}</option>
        <option v-if="showCalendar" value="calendar">{{ $t('allTasks.calendarOnly') }}</option>
        <optgroup v-if="showCustomList && customLists.length" :label="$t('todoDetails.todoLists')">
          <option v-for="list in customLists" :key="list.listId" :value="list.listId">
            {{ list.listName || $t('generatedData.list1') }}
          </option>
        </optgroup>
      </select>

      <select v-if="availableColors.length" v-model="colorFilter" class="all-tasks-select" :aria-label="$t('todoDetails.color')">
        <option value="all">{{ $t('allTasks.allColors') }}</option>
        <option v-for="color in availableColors" :key="color" :value="color">{{ colorLabel(color) }}</option>
      </select>

      <div class="workspace-segment all-tasks-groupby" role="group" :aria-label="$t('allTasks.groupBy')">
        <button type="button" :class="{ active: groupBy === 'deadline' }" :aria-pressed="groupBy === 'deadline'"
          @click="groupBy = 'deadline'">{{ $t('allTasks.byDeadline') }}</button>
        <button type="button" :class="{ active: groupBy === 'list' }" :aria-pressed="groupBy === 'list'"
          @click="groupBy = 'list'">{{ $t('allTasks.byList') }}</button>
      </div>
    </div>

    <div class="custom-list-content all-tasks-content">
      <div v-if="loading" class="workspace-list-loading">{{ $t('todoDetails.loading') }}</div>
      <div v-else-if="!groups.length && !completed.length" class="all-tasks-empty">
        <i :class="hasActiveFilters ? 'bi-funnel' : 'bi-check2-circle'" aria-hidden="true"></i>
        <p>{{ hasActiveFilters ? $t('allTasks.noMatches') : $t('allTasks.emptyPending') }}</p>
        <button v-if="hasActiveFilters" type="button" class="all-tasks-reset" @click="resetFilters">
          {{ $t('allTasks.resetFilters') }}
        </button>
      </div>
      <div v-else>
        <section v-for="group in groups" :key="group.key" class="deadline-group"
          :class="{ 'is-overdue-group': group.kind === 'overdue' }">
          <h2>
            <button v-if="groupBy === 'list'" type="button" class="group-heading-link" @click="openGroupSource(group)">
              <i :class="group.kind === 'calendar' ? 'bi-calendar-event' : 'bi-list-ul'" aria-hidden="true"></i>
              {{ groupLabel(group) }}
            </button>
            <template v-else>{{ groupLabel(group) }}</template>
            <span>{{ group.tasks.length }}</span>
          </h2>
          <to-do-item v-for="entry in group.tasks" :key="entry.key" :to-do="entry.task"
            :index="entry.index" :to-do-list-id="entry.listId"
            :source-label="groupBy === 'deadline' ? sourceLabel(entry) : ''"
            :source-type="entry.sourceType"
            :is-overdue="entry.isOverdue"
            @open-source="openEntrySource(entry)" />
        </section>

        <section v-if="completed.length" class="deadline-group completed-group">
          <button type="button" class="completed-toggle" :aria-expanded="showCompleted" @click="showCompleted = !showCompleted">
            <i :class="showCompleted ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
            {{ $t('todoDetails.completed') }} <span>{{ completed.length }}</span>
          </button>
          <div v-if="showCompleted">
            <to-do-item v-for="entry in completed" :key="entry.key" :to-do="entry.task"
              :index="entry.index" :to-do-list-id="entry.listId"
              :source-label="sourceLabel(entry)"
              :source-type="entry.sourceType"
              @open-source="openEntrySource(entry)" />
          </div>
        </section>
      </div>
    </div>

    <div class="all-tasks-quick-add">
      <select v-model="quickAddTarget" class="all-tasks-target-select" :aria-label="$t('allTasks.targetList')">
        <option v-if="showCalendar" :value="todayKey">{{ $t('ui.today') }}</option>
        <option v-for="list in customLists" :key="list.listId" :value="list.listId">
          {{ list.listName || $t('generatedData.list1') }}
        </option>
      </select>
      <input ref="quickAddInput" v-model="newTaskText" class="new-todo-input all-tasks-new-task" type="text"
        :placeholder="$t('ui.newTask')" @keyup.enter="addQuickTask" @keyup.esc="newTaskText = ''" />
    </div>
  </section>
</template>

<script>
import moment from "moment";
import ToDoItem from "../toDoItem.vue";
import toDoListRepository from "../../repositories/toDoListRepository";
import notifications from "../../helpers/notifications";
import {
  collectAllTasks,
  computeTaskSummary,
  filterAllTasks,
  groupAllTasksByDeadline,
  groupAllTasksByList,
} from "../../helpers/allTasks";

const COLOR_NAMES = {
  "#77e785": "Green",
  "#06b6d4": "Cyan",
  "#5e6ef2": "Indigo",
  "#8b5cf6": "Purple",
  "#ed56a1": "Pink",
  "#ed544b": "Red",
  "#f97316": "Orange",
  "#f9d54a": "Yellow",
  "#ba7956": "Brown",
  "#6b7280": "Gray",
  "#030712": "Black",
};

export default {
  name: "AllTasksView",
  components: { ToDoItem },
  props: {
    todayKey: { type: String, required: true },
  },
  emits: ["navigate-source", "summary-change"],
  data() {
    return {
      loading: false,
      searchQuery: "",
      bucketFilter: "all",
      sourceFilter: "all",
      colorFilter: "all",
      groupBy: "deadline",
      showCompleted: false,
      newTaskText: "",
      quickAddTarget: "",
    };
  },
  computed: {
    config() { return this.$store.getters.config; },
    language() { return this.config.language; },
    showCalendar() { return this.config.calendar; },
    showCustomList() { return this.config.customList; },
    customLists() { return this.$store.getters.cTodoListIds || []; },
    allEntries() {
      const entries = collectAllTasks(this.$store.getters.todoLists, this.customLists, {
        now: moment(),
      });
      return entries.filter(entry => {
        if (entry.sourceType === "custom" && !this.showCustomList) return false;
        if (entry.sourceType === "calendar" && !this.showCalendar) return false;
        return true;
      });
    },
    sourceScopedEntries() {
      return filterAllTasks(this.allEntries, { source: this.sourceFilter, color: this.colorFilter });
    },
    summary() {
      return computeTaskSummary(this.sourceScopedEntries);
    },
    availableColors() {
      const colors = new Set();
      this.allEntries.forEach(entry => {
        if (entry.task.color && entry.task.color !== "none") colors.add(entry.task.color);
      });
      return [...colors];
    },
    filteredEntries() {
      return filterAllTasks(this.allEntries, {
        query: this.searchQuery,
        bucket: this.bucketFilter,
        source: this.sourceFilter,
        color: this.colorFilter,
      });
    },
    organized() {
      return this.groupBy === "list"
        ? groupAllTasksByList(this.filteredEntries, this.customLists)
        : groupAllTasksByDeadline(this.filteredEntries, moment());
    },
    groups() { return this.organized.groups; },
    completed() { return this.organized.completed; },
    hasActiveFilters() {
      return !!(this.searchQuery.trim() || this.bucketFilter !== "all" || this.sourceFilter !== "all" || this.colorFilter !== "all");
    },
  },
  watch: {
    customLists: {
      immediate: true,
      deep: true,
      handler() { this.ensureQuickAddTarget(); },
    },
    sourceFilter(val) {
      if (val !== "all" && val !== "custom" && val !== "calendar") {
        this.quickAddTarget = val;
      } else if (val === "calendar" && this.showCalendar) {
        this.quickAddTarget = this.todayKey;
      }
    },
    todayKey() { this.ensureQuickAddTarget(); },
    summary: {
      immediate: true,
      handler(val) { this.$emit("summary-change", val); },
    },
  },
  mounted() {
    this.ensureQuickAddTarget();
    if (!this.$store.getters.allListsLoaded) {
      this.loading = true;
      this.$store.dispatch("loadAllTodoLists").then(() => {
        this.loading = false;
      });
    }
  },
  methods: {
    ensureQuickAddTarget() {
      const validCustom = this.customLists.some(list => list.listId === this.quickAddTarget);
      if (validCustom || (this.showCalendar && this.quickAddTarget === this.todayKey)) return;
      if (this.customLists.length && this.showCustomList) this.quickAddTarget = this.customLists[0].listId;
      else if (this.showCalendar) this.quickAddTarget = this.todayKey;
      else this.quickAddTarget = "";
    },
    resetFilters() {
      this.searchQuery = "";
      this.bucketFilter = "all";
      this.sourceFilter = "all";
      this.colorFilter = "all";
    },
    colorLabel(hex) {
      return COLOR_NAMES[hex.toLowerCase()] || hex;
    },
    sourceLabel(entry) {
      if (entry.sourceType === "custom") return entry.sourceName || this.$t("generatedData.list1");
      if (entry.listId === this.todayKey) return this.$t("ui.today");
      return moment(entry.listId, "YYYYMMDD", true).locale(this.language).format("D MMM");
    },
    groupLabel(group) {
      if (group.kind === "overdue") return this.$t("allTasks.overdue");
      if (group.kind === "today") return this.$t("ui.today");
      if (group.kind === "tomorrow") return this.$t("allTasks.tomorrow");
      if (group.kind === "noDeadline") return this.$t("todoDetails.noDeadline");
      if (group.kind === "date") return moment(group.date, "YYYY-MM-DD", true).locale(this.language).format("LL");
      if (group.kind === "custom") return group.name || this.$t("generatedData.list1");
      if (group.kind === "calendar") {
        if (group.listId === this.todayKey) return `${this.$t("settings.calendar")} · ${this.$t("ui.today")}`;
        return `${this.$t("settings.calendar")} · ${moment(group.listId, "YYYYMMDD", true).locale(this.language).format("LL")}`;
      }
      return "";
    },
    openEntrySource(entry) {
      this.$emit("navigate-source", { type: entry.sourceType, id: entry.listId });
    },
    openGroupSource(group) {
      this.$emit("navigate-source", { type: group.kind, id: group.listId });
    },
    addQuickTask() {
      const text = this.newTaskText.trim();
      const targetId = this.quickAddTarget;
      if (!text || !targetId) return;
      const commitTask = () => {
        const deadlineDate = this.bucketFilter === "today" ? moment(this.todayKey, "YYYYMMDD").format("YYYY-MM-DD") : null;
        this.$store.commit("addTodo", {
          text, checked: false, listId: targetId, desc: "", subTaskList: [], color: "none",
          priority: 0, tags: [], time: null, deadlineDate, deadlineTime: null,
          alarm: false, repeatingEvent: null,
        });
        toDoListRepository.update(targetId, this.$store.getters.todoLists[targetId]);
        notifications.refreshDayNotifications(this, targetId);
        this.newTaskText = "";
        this.$nextTick(() => this.$refs.quickAddInput && this.$refs.quickAddInput.focus());
      };
      if (this.$store.getters.todoLists[targetId]) commitTask();
      else this.$store.dispatch("loadTodoLists", targetId).then(commitTask);
    },
  },
};
</script>
