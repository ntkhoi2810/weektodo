<template>
  <comfirm-modal id="clearCompletedModal" :title="$t('ui.clearCompleted')"
    :text="$t('ui.clearCompletedConfirm', { count: completedCount })" ico="bi-trash"
    :ok-text="$t('ui.clear')" @on-ok="clearCompleted" />
</template>

<script>
import comfirmModal from "../comfirmModal.vue";
import toDoListRepository from "../../repositories/toDoListRepository";
import notifications from "../../helpers/notifications";

export default {
  name: "clearCompletedModal",
  components: { comfirmModal },
  computed: {
    listId() { return this.$store.getters.completedToClearId; },
    completedCount() {
      return (this.$store.getters.todoLists[this.listId] || []).filter(task => task.checked).length;
    },
  },
  methods: {
    clearCompleted() {
      const listId = this.listId;
      if (!listId || !this.completedCount) return;
      this.$store.commit("clearCompletedTodos", listId);
      toDoListRepository.update(listId, this.$store.getters.todoLists[listId]);
      notifications.refreshDayNotifications(this);
    },
  },
};
</script>
