<template>
  <section :id="'list' + id" class="custom-list-view">
    <list-header :id="id" :custom-todo-list="true" :c-todo-list-index="listIndex" :to-do-list="tasks" />
    <div class="custom-list-content" @dragleave="onContentDragLeave">
      <div v-if="loading" class="workspace-list-loading">{{ $t('todoDetails.loading') }}</div>
      <div v-else>
        <section v-for="group in groups" :key="group.key" class="deadline-group"
          :class="{ 'is-overdue-group': group.overdue, 'is-drop-target': groupDropHover === group.key }"
          @dragover.prevent="onGroupDragOver($event, group.key)"
          @dragleave="onGroupDragLeave($event, group.key)"
          @drop.prevent="onGroupDrop($event, group.key, group.tasks)">
          <h2>
            {{ group.label }}
            <span v-if="group.overdue" class="overdue-badge">{{ $t('allTasks.overdue') }}</span>
            <span>{{ group.tasks.length }}</span>
          </h2>
          <div v-for="entry in group.tasks" :key="entry.index" class="drop-zone"
            @dragover.stop.prevent="onItemDragOver($event, entry.index)"
            @dragenter.stop.prevent="onItemDragOver($event, entry.index)"
            @drop.stop.prevent="onItemDrop($event, entry, group.key)">
            <to-do-item :to-do="entry.task" :index="entry.index" :to-do-list-id="id"
              :drop-position="dropTarget && dropTarget.index === entry.index ? dropTarget.position : ''" />
          </div>
        </section>
        <section class="deadline-group" :class="{ 'is-drop-target': groupDropHover === 'noDeadline' }"
          @dragover.prevent="onGroupDragOver($event, 'noDeadline')"
          @dragleave="onGroupDragLeave($event, 'noDeadline')"
          @drop.prevent="onGroupDrop($event, null, noDeadline)">
          <h2>{{ $t('todoDetails.noDeadline') }} <span>{{ noDeadline.length }}</span></h2>
          <div v-for="entry in noDeadline" :key="entry.index" class="drop-zone"
            @dragover.stop.prevent="onItemDragOver($event, entry.index)"
            @dragenter.stop.prevent="onItemDragOver($event, entry.index)"
            @drop.stop.prevent="onItemDrop($event, entry, null)">
            <to-do-item :to-do="entry.task" :index="entry.index" :to-do-list-id="id"
              :drop-position="dropTarget && dropTarget.index === entry.index ? dropTarget.position : ''" />
          </div>
          <div v-if="!noDeadline.length" class="group-empty-drop">{{ $t('ui.dropHereNoDeadline') }}</div>
        </section>
        <section v-if="completed.length" class="deadline-group completed-group">
          <button type="button" class="completed-toggle" :aria-expanded="showCompleted" @click="showCompleted = !showCompleted">
            <i :class="showCompleted ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
            {{ $t('todoDetails.completed') }} <span>{{ completed.length }}</span>
          </button>
          <div v-if="showCompleted">
            <to-do-item v-for="entry in completed" :key="entry.index" :to-do="entry.task"
              :index="entry.index" :to-do-list-id="id" />
          </div>
        </section>
      </div>
    </div>
    <quick-add-bar ref="quickAdd" :today-key="todayKey" :show-calendar="!!$store.getters.config.calendar"
      @add-task="addTask" />
  </section>
</template>

<script>
import moment from "moment";
import ListHeader from "../listHeader.vue";
import ToDoItem from "../toDoItem.vue";
import QuickAddBar from "../QuickAddBar.vue";
import { groupTasksByDeadline, isDateOverdue } from "../../helpers/deadline";
import {
  computeCrossListIndex,
  computeDropPosition,
  computeReorderIndex,
  createTaskObject,
  getDragPayload,
  isTaskDragEvent,
} from "../../helpers/taskOperations";
import { moveTaskWithFeedback, persistTodoList } from "../../helpers/taskActions";

export default {
  name: "CustomListView",
  components: { ListHeader, ToDoItem, QuickAddBar },
  props: { id: { type: String, required: true } },
  data() {
    return {
      loading: false,
      showCompleted: false,
      dropTarget: null,
      groupDropHover: null,
    };
  },
  computed: {
    todayKey() { return moment().format("YYYYMMDD"); },
    tasks() { return this.$store.getters.todoLists[this.id] || []; },
    listIndex() { return this.$store.getters.cTodoListIds.findIndex(list => list.listId === this.id); },
    organization() {
      return groupTasksByDeadline(this.tasks, {
        preserveManualOrder: !this.$store.getters.config.autoReorderTasks,
      });
    },
    noDeadline() { return this.organization.noDeadline; },
    completed() { return this.organization.completed; },
    groups() {
      return this.organization.groups.map(({ date, tasks }) => ({
        key: date,
        label: moment(date, "YYYY-MM-DD").locale(this.$store.getters.config.language).format("LL"),
        overdue: isDateOverdue(date),
        tasks,
      }));
    },
  },
  watch: { id: { immediate: true, handler(id) {
    if (!id) return;
    this.loading = true;
    this.$store.dispatch("loadTodoLists", id).then(() => { this.loading = false; });
    this.showCompleted = false;
    this.dropTarget = null;
    this.groupDropHover = null;
  } } },
  methods: {
    addTask({ text, deadlineDate }) {
      const clean = (text || "").trim();
      if (!clean) return;
      this.$store.commit("addTodo", createTaskObject(clean, { listId: this.id, deadlineDate }));
      persistTodoList(this, this.id, { reorder: true });
    },
    onContentDragLeave(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.dropTarget = null;
        this.groupDropHover = null;
      }
    },
    onItemDragOver(event, index) {
      if (!isTaskDragEvent(event)) return;
      this.groupDropHover = null;
      this.dropTarget = { index, position: computeDropPosition(event) };
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
    async onItemDrop(event, targetEntry, targetDeadlineDate) {
      const position = this.dropTarget && this.dropTarget.index === targetEntry.index
        ? this.dropTarget.position
        : computeDropPosition(event);
      this.dropTarget = null;
      this.groupDropHover = null;

      const payload = getDragPayload(event);
      if (!payload) return;

      if (payload.listId === this.id) {
        const task = this.tasks[payload.index];
        if (!task) return;
        const normalizedTarget = targetDeadlineDate || null;
        const deadlineChanged = (task.deadlineDate || null) !== normalizedTarget;
        if (deadlineChanged) {
          task.deadlineDate = normalizedTarget;
          if (!normalizedTarget) task.alarm = false;
        }
        const { moved, insertIndex } = computeReorderIndex(payload.index, targetEntry.index, position);
        if (moved) {
          this.$store.commit("reorderTodo", { listId: this.id, fromIndex: payload.index, toIndex: insertIndex });
        }
        if (moved || deadlineChanged) {
          persistTodoList(this, this.id, { reorder: true });
        }
      } else {
        const insertIndex = computeCrossListIndex(targetEntry.index, position, this.tasks.length);
        const patch = {
          deadlineDate: targetDeadlineDate || null,
          ...(targetDeadlineDate ? {} : { alarm: false }),
        };
        await moveTaskWithFeedback(this, {
          fromListId: payload.listId,
          fromIndex: payload.index,
          toListId: this.id,
          toIndex: insertIndex,
          patch,
        });
      }
    },
    async onGroupDrop(event, targetDeadlineDate, groupTasks) {
      this.dropTarget = null;
      this.groupDropHover = null;

      const payload = getDragPayload(event);
      if (!payload) return;

      const lastEntry = groupTasks && groupTasks.length ? groupTasks[groupTasks.length - 1] : null;

      if (payload.listId === this.id) {
        const task = this.tasks[payload.index];
        if (!task) return;
        const normalizedTarget = targetDeadlineDate || null;
        const deadlineChanged = (task.deadlineDate || null) !== normalizedTarget;
        if (deadlineChanged) {
          task.deadlineDate = normalizedTarget;
          if (!normalizedTarget) task.alarm = false;
        }
        let moved = false;
        if (lastEntry) {
          const reorder = computeReorderIndex(payload.index, lastEntry.index, "after");
          if (reorder.moved) {
            moved = true;
            this.$store.commit("reorderTodo", { listId: this.id, fromIndex: payload.index, toIndex: reorder.insertIndex });
          }
        }
        if (moved || deadlineChanged) {
          persistTodoList(this, this.id, { reorder: true });
        }
      } else {
        const insertIndex = lastEntry ? lastEntry.index + 1 : null;
        const patch = {
          deadlineDate: targetDeadlineDate || null,
          ...(targetDeadlineDate ? {} : { alarm: false }),
        };
        await moveTaskWithFeedback(this, {
          fromListId: payload.listId,
          fromIndex: payload.index,
          toListId: this.id,
          toIndex: insertIndex,
          patch,
        });
      }
    },
  },
};
</script>
