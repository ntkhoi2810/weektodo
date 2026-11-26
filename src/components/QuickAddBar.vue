<template>
  <form class="quick-add-bar" @submit.prevent="submit">
    <div class="quick-add-row">
      <select v-if="showTargetSelector" :value="targetId" class="all-tasks-target-select"
        :aria-label="$t('allTasks.targetList')" @change="$emit('update:targetId', $event.target.value)">
        <option v-if="showCalendar" :value="todayKey">{{ $t('ui.today') }}</option>
        <option v-for="list in customLists" :key="list.listId" :value="list.listId">
          {{ list.listName || $t('generatedData.list1') }}
        </option>
      </select>
      <div class="quick-add-input-wrap">
        <i class="bi-plus-lg quick-add-plus" aria-hidden="true"></i>
        <input ref="input" v-model="text" class="new-todo-input quick-add-input" type="text"
          :placeholder="$t('ui.newTask')" @keyup.esc="text = ''" />
      </div>
      <button type="submit" class="quick-add-submit" :disabled="!text.trim()" :aria-label="$t('ui.newTask')">
        <i class="bi-arrow-return-left" aria-hidden="true"></i>
      </button>
    </div>
    <div class="quick-add-chips" role="group" :aria-label="$t('todoDetails.deadline')">
      <button type="button" class="quick-add-chip" :class="{ active: selectedPreset === 'none' }"
        :aria-pressed="selectedPreset === 'none'" @click="selectPreset('none')">
        {{ $t('quickAdd.noDeadline') }}
      </button>
      <button type="button" class="quick-add-chip" :class="{ active: selectedPreset === 'today' }"
        :aria-pressed="selectedPreset === 'today'" @click="selectPreset('today')">
        <i class="bi-sun" aria-hidden="true"></i> {{ $t('ui.today') }}
      </button>
      <button type="button" class="quick-add-chip" :class="{ active: selectedPreset === 'tomorrow' }"
        :aria-pressed="selectedPreset === 'tomorrow'" @click="selectPreset('tomorrow')">
        <i class="bi-sunrise" aria-hidden="true"></i> {{ $t('allTasks.tomorrow') }}
      </button>
      <button type="button" class="quick-add-chip" :class="{ active: selectedPreset === 'nextWeek' }"
        :aria-pressed="selectedPreset === 'nextWeek'" @click="selectPreset('nextWeek')">
        <i class="bi-calendar-range" aria-hidden="true"></i> {{ $t('quickMove.nextWeek') }}
      </button>
      <div class="quick-add-date-wrap">
        <button type="button" class="quick-add-chip quick-add-date-chip"
          :class="{ active: selectedPreset === 'custom' }"
          :aria-pressed="selectedPreset === 'custom'"
          @click="openDatePicker">
          <i class="bi-calendar-event" aria-hidden="true"></i>
          <span>{{ customDateLabel }}</span>
        </button>
        <input ref="dateInput" type="date" class="quick-add-native-date"
          :class="{ 'is-visible': showInlineDate }"
          :value="customDate" :aria-label="$t('quickAdd.pickDate')"
          @change="onPickCustomDate($event.target.value)" />
      </div>
      <button v-if="selectedPreset === 'custom'" type="button" class="quick-add-clear-date"
        :aria-label="$t('todoDetails.clearDate')" @click="clearCustomDate">
        <i class="bi-x" aria-hidden="true"></i>
      </button>
    </div>
  </form>
</template>

<script>
import moment from "moment";
import { computeQuickDeadline } from "../helpers/taskOperations";

export default {
  name: "QuickAddBar",
  props: {
    showTargetSelector: { type: Boolean, default: false },
    targetId: { type: String, default: "" },
    todayKey: { type: String, required: true },
    customLists: { type: Array, default: () => [] },
    showCalendar: { type: Boolean, default: true },
    defaultPreset: { type: String, default: "none" },
  },
  emits: ["update:targetId", "add-task"],
  data() {
    return {
      text: "",
      selectedPreset: this.defaultPreset || "none",
      customDate: "",
      userTouchedPreset: false,
      showInlineDate: false,
    };
  },
  computed: {
    config() { return this.$store.getters.config; },
    weekStartOnMonday() { return this.config.weekStartOnMonday !== false; },
    language() { return this.config.language; },
    resolvedDeadline() {
      if (this.selectedPreset === "custom") return this.customDate || null;
      return computeQuickDeadline(this.selectedPreset, { weekStartOnMonday: this.weekStartOnMonday });
    },
    customDateLabel() {
      if (this.selectedPreset === "custom" && this.customDate) {
        return moment(this.customDate, "YYYY-MM-DD", true).locale(this.language).format("D MMM");
      }
      return this.$t("quickAdd.pickDate");
    },
  },
  watch: {
    defaultPreset(val) {
      if (!this.userTouchedPreset) this.selectedPreset = val || "none";
    },
  },
  methods: {
    focus() {
      if (this.$refs.input) this.$refs.input.focus();
    },
    selectPreset(preset) {
      this.userTouchedPreset = true;
      this.selectedPreset = preset;
      this.showInlineDate = false;
      this.$nextTick(() => this.focus());
    },
    openDatePicker() {
      const input = this.$refs.dateInput;
      if (input && typeof input.showPicker === "function") {
        try {
          input.showPicker();
          return;
        } catch (e) {
          // fallback to visible inline date input
        }
      }
      this.showInlineDate = !this.showInlineDate;
      if (this.showInlineDate) {
        this.$nextTick(() => input && input.focus());
      }
    },
    onPickCustomDate(value) {
      if (!value || !moment(value, "YYYY-MM-DD", true).isValid()) return;
      this.userTouchedPreset = true;
      this.customDate = value;
      this.selectedPreset = "custom";
      this.showInlineDate = false;
      this.$nextTick(() => this.focus());
    },
    clearCustomDate() {
      this.customDate = "";
      this.selectedPreset = "none";
      this.showInlineDate = false;
      this.$nextTick(() => this.focus());
    },
    submit() {
      const text = this.text.trim();
      if (!text) return;
      this.$emit("add-task", {
        text,
        targetId: this.targetId,
        deadlineDate: this.resolvedDeadline,
      });
      this.text = "";
      this.$nextTick(() => this.focus());
    },
  },
};
</script>
