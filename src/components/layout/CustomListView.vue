<template>
  <section :id="'list' + id" class="custom-list-view">
    <list-header :id="id" :custom-todo-list="true" :c-todo-list-index="listIndex" :to-do-list="tasks" />
    <div class="custom-list-content">
      <div v-if="loading" class="workspace-list-loading">{{ $t('todoDetails.loading') }}</div>
      <div v-else>
        <section v-for="group in groups" :key="group.key" class="deadline-group">
          <h2>{{ group.label }} <span>{{ group.tasks.length }}</span></h2>
          <to-do-item v-for="entry in group.tasks" :key="entry.index" :to-do="entry.task"
            :index="entry.index" :to-do-list-id="id" />
        </section>
        <section class="deadline-group">
          <h2>{{ $t('todoDetails.noDeadline') }} <span>{{ noDeadline.length }}</span></h2>
          <to-do-item v-for="entry in noDeadline" :key="entry.index" :to-do="entry.task"
            :index="entry.index" :to-do-list-id="id" />
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
    <input ref="newTask" v-model="newTaskText" class="new-todo-input custom-list-new-task" type="text"
      :placeholder="$t('ui.newTask')" @keyup.enter="addTask" @keyup.esc="newTaskText = ''" @blur="addTask" />
  </section>
</template>

<script>
import moment from "moment";
import ListHeader from "../listHeader.vue";
import ToDoItem from "../toDoItem.vue";
import toDoListRepository from "../../repositories/toDoListRepository";
import notifications from "../../helpers/notifications";
import { groupTasksByDeadline } from "../../helpers/deadline";

export default {
  name: "CustomListView",
  components: { ListHeader, ToDoItem },
  props: { id: { type: String, required: true } },
  data() { return { loading: false, newTaskText: "", showCompleted: false }; },
  computed: {
    tasks() { return this.$store.getters.todoLists[this.id] || []; },
    listIndex() { return this.$store.getters.cTodoListIds.findIndex(list => list.listId === this.id); },
    organization() { return groupTasksByDeadline(this.tasks); },
    noDeadline() { return this.organization.noDeadline; },
    completed() { return this.organization.completed; },
    groups() {
      return this.organization.groups.map(({ date, tasks }) => ({
        key: date,
        label: moment(date, "YYYY-MM-DD").locale(this.$store.getters.config.language).format("LL"),
        tasks,
      }));
    },
  },
  watch: { id: { immediate: true, handler(id) {
    if (!id) return;
    this.loading = true;
    this.$store.dispatch("loadTodoLists", id).then(() => { this.loading = false; });
    this.showCompleted = false;
  } } },
  methods: {
    addTask() {
      const text = this.newTaskText.trim();
      if (!text) return;
      this.$store.commit("addTodo", {
        text, checked: false, listId: this.id, desc: "", subTaskList: [], color: "none",
        priority: 0, tags: [], time: null, deadlineDate: null, deadlineTime: null,
        alarm: false, repeatingEvent: null,
      });
      toDoListRepository.update(this.id, this.tasks);
      notifications.refreshDayNotifications(this, this.id);
      this.newTaskText = "";
      this.$nextTick(() => this.$refs.newTask.focus());
    },
  },
};
</script>
