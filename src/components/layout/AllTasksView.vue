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

    <div class="custom-list-content all-tasks-content" @dragleave="onContentDragLeave">
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
          :class="{ 'is-overdue-group': group.kind === 'overdue', 'is-drop-target': groupDropHover === group.key }"
          @dragover.prevent="onGroupDragOver($event, group.key)"
          @dragleave="onGroupDragLeave($event, group.key)"
          @drop.prevent="onGroupDrop($event, group)">
          <h2>
            <button v-if="groupBy === 'list'" type="button" class="group-heading-link" @click="openGroupSource(group)">
              <i :class="group.kind === 'calendar' ? 'bi-calendar-event' : 'bi-list-ul'" aria-hidden="true"></i>
              {{ groupLabel(group) }}
            </button>
            <template v-else>{{ groupLabel(group) }}</template>
            <span>{{ group.tasks.length }}</span>
          </h2>
          <div v-for="entry in group.tasks" :key="entry.key" class="drop-zone"
            @dragover.stop.prevent="onItemDragOver($event, entry)"
            @dragenter.stop.prevent="onItemDragOver($event, entry)"
            @drop.stop.prevent="onItemDrop($event, entry, group)">
            <to-do-item :to-do="entry.task" :index="entry.index" :to-do-list-id="entry.listId"
              :source-label="groupBy === 'deadline' ? sourceLabel(entry) : ''"
              :source-type="entry.sourceType"
              :is-overdue="entry.isOverdue"
              :drop-position="dropTarget && dropTarget.key === entry.key ? dropTarget.position : ''"
              @open-source="openEntrySource(entry)" />
          </div>
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

    <quick-add-bar :show-target-selector="true" v-model:target-id="quickAddTarget"
      :today-key="todayKey" :custom-lists="customLists" :show-calendar="showCalendar"
      :default-preset="bucketFilter === 'today' ? 'today' : 'none'"
      @add-task="addQuickTask" />
  </section>
</template>

<script>
import moment from "moment";
import ToDoItem from "../toDoItem.vue";
import QuickAddBar from "../QuickAddBar.vue";
import {
  collectAllTasks,
  computeTaskSummary,
  filterAllTasks,
  groupAllTasksByDeadline,
  groupAllTasksByList,
  isCalendarListId,
} from "../../helpers/allTasks";
import {
  buildMovePatch,
  clearDragPayload,
  computeCrossListIndex,
  computeDropPosition,
  computeReorderIndex,
  createTaskObject,
  getDragPayload,
  isTaskDragEvent,
  reorderGroupTasks,
} from "../../helpers/taskOperations";
import { moveTaskWithFeedback, persistTodoList } from "../../helpers/taskActions";

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
  components: { ToDoItem, QuickAddBar },
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
      quickAddTarget: "",
      dropTarget: null,
      groupDropHover: null,
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
      const preserveManualOrder = !this.config.autoReorderTasks;
      return this.groupBy === "list"
        ? groupAllTasksByList(this.filteredEntries, this.customLists, { preserveManualOrder })
        : groupAllTasksByDeadline(this.filteredEntries, moment(), { preserveManualOrder });
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
    addQuickTask({ text, targetId, deadlineDate }) {
      const clean = (text || "").trim();
      const destination = targetId || this.quickAddTarget;
      if (!clean || !destination) return;
      const commitTask = () => {
        this.$store.commit("addTodo", createTaskObject(clean, { listId: destination, deadlineDate }));
        persistTodoList(this, destination, { reorder: true });
      };
      if (this.$store.getters.todoLists[destination]) commitTask();
      else this.$store.dispatch("loadTodoLists", destination).then(commitTask);
    },
    onContentDragLeave(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.dropTarget = null;
        this.groupDropHover = null;
      }
    },
    onItemDragOver(event, entry) {
      if (!isTaskDragEvent(event)) return;
      this.groupDropHover = null;
      this.dropTarget = { key: entry.key, position: computeDropPosition(event) };
    },
    onGroupDragOver(event, groupKey) {
      if (!isTaskDragEvent(event)) return;
      this.dropTarget = null;
      this.groupDropHover = groupKey;
    },
    onGroupDragLeave(event, groupKey) {
      if (!event.currentTarget.contains(event.relatedTarget) && this.groupDropHover === groupKey) {
        this.groupDropHover = null;
      }
    },
    async onItemDrop(event, targetEntry, targetGroup) {
      const position = this.dropTarget && this.dropTarget.key === targetEntry.key
        ? this.dropTarget.position
        : computeDropPosition(event);
      this.dropTarget = null;
      this.groupDropHover = null;

      const payload = getDragPayload(event);
      clearDragPayload();
      if (!payload) return;

      if (this.groupBy === "list") {
        await this.handleListModeItemDrop(payload, targetEntry, position);
      } else {
        await this.handleDeadlineModeDrop(payload, targetGroup, targetEntry, position);
      }
    },
    async onGroupDrop(event, group) {
      this.dropTarget = null;
      this.groupDropHover = null;

      const payload = getDragPayload(event);
      clearDragPayload();
      if (!payload) return;

      if (this.groupBy === "list") {
        const targetListId = group.listId;
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
      } else {
        const lastEntry = group.tasks && group.tasks.length ? group.tasks[group.tasks.length - 1] : null;
        await this.handleDeadlineModeDrop(payload, group, lastEntry, "after");
      }
    },
    async handleListModeItemDrop(payload, targetEntry, position) {
      if (payload.listId === targetEntry.listId) {
        const { moved, insertIndex } = computeReorderIndex(payload.index, targetEntry.index, position);
        if (!moved) return;
        this.$store.commit("reorderTodo", { listId: targetEntry.listId, fromIndex: payload.index, toIndex: insertIndex });
        persistTodoList(this, targetEntry.listId, { reorder: true });
      } else {
        const targetList = this.$store.getters.todoLists[targetEntry.listId] || [];
        const insertIndex = computeCrossListIndex(targetEntry.index, position, targetList.length);
        const patch = buildMovePatch(payload.toDo, targetEntry.listId);
        await moveTaskWithFeedback(this, {
          fromListId: payload.listId,
          fromIndex: payload.index,
          toListId: targetEntry.listId,
          toIndex: insertIndex,
          patch,
        });
      }
    },
    async handleDeadlineModeDrop(payload, targetGroup, targetEntry, position) {
      const sourceList = this.$store.getters.todoLists[payload.listId];
      if (!Array.isArray(sourceList) || !sourceList[payload.index]) return;
      const sourceTask = sourceList[payload.index];
      const sourceKey = `${payload.listId}:${payload.index}`;

      const fromGroupIndex = targetGroup.tasks.findIndex(e => e.key === sourceKey);
      const targetGroupIndex = targetEntry
        ? targetGroup.tasks.findIndex(e => e.key === targetEntry.key)
        : targetGroup.tasks.length - 1;

      // Case 1: Reordering within the same deadline group
      if (fromGroupIndex >= 0) {
        if (targetGroupIndex < 0) return;
        const result = reorderGroupTasks(targetGroup.tasks, fromGroupIndex, targetGroupIndex, position);
        if (!result.moved) return;
        if (result.sameListReorder) {
          this.$store.commit("reorderTodo", result.sameListReorder);
        }
        result.affectedListIds.forEach(listId => persistTodoList(this, listId, { reorder: true }));
        return;
      }

      // Case 2: Dragging across different deadline groups
      if (targetGroup.kind === "overdue") return;

      const targetDate = targetGroup.kind === "noDeadline" ? null : targetGroup.date;
      const insertSlot = targetGroupIndex >= 0
        ? (position === "after" ? targetGroupIndex + 1 : targetGroupIndex)
        : targetGroup.tasks.length;

      const updatedGroupTasks = [...targetGroup.tasks];
      updatedGroupTasks.splice(insertSlot, 0, { task: sourceTask, listId: payload.listId, index: payload.index });
      updatedGroupTasks.forEach((entry, idx) => {
        if (entry && entry.task) entry.task.manualOrder = idx;
      });

      const affectedIds = new Set(updatedGroupTasks.map(e => e.listId));
      affectedIds.add(payload.listId);

      if (isCalendarListId(payload.listId)) {
        if (targetDate) {
          const targetCalListId = moment(targetDate, "YYYY-MM-DD", true).format("YYYYMMDD");
          const patch = sourceTask.deadlineDate ? { deadlineDate: targetDate } : {};
          if (targetCalListId !== payload.listId) {
            await moveTaskWithFeedback(this, {
              fromListId: payload.listId,
              fromIndex: payload.index,
              toListId: targetCalListId,
              toIndex: null,
              patch,
            });
          } else if (sourceTask.deadlineDate !== targetDate) {
            sourceTask.deadlineDate = targetDate;
          }
        } else if (this.customLists.length > 0) {
          await moveTaskWithFeedback(this, {
            fromListId: payload.listId,
            fromIndex: payload.index,
            toListId: this.customLists[0].listId,
            toIndex: null,
            patch: { deadlineDate: null, alarm: false },
          });
        }
      } else {
        sourceTask.deadlineDate = targetDate;
        if (!targetDate) sourceTask.alarm = false;
        if (targetEntry && targetEntry.listId === payload.listId) {
          const sameList = computeReorderIndex(payload.index, targetEntry.index, position);
          if (sameList.moved) {
            this.$store.commit("reorderTodo", { listId: payload.listId, fromIndex: payload.index, toIndex: sameList.insertIndex });
          }
        }
      }

      affectedIds.forEach(listId => {
        if (this.$store.getters.todoLists[listId]) {
          persistTodoList(this, listId, { reorder: true });
        }
      });
    },
  },
};
</script>
