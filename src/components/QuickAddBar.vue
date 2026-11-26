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
        <button ref="dateBtn" type="button" class="quick-add-chip quick-add-date-chip"
          :class="{ active: selectedPreset === 'custom' || datePopoverOpen }"
          :aria-pressed="selectedPreset === 'custom'"
          :aria-expanded="datePopoverOpen"
          @click.stop="toggleDatePopover">
          <i class="bi-calendar-event" aria-hidden="true"></i>
          <span>{{ customDateLabel }}</span>
          <i class="bi-chevron-down quick-add-date-caret" aria-hidden="true"></i>
        </button>
      </div>
      <button v-if="selectedPreset === 'custom'" type="button" class="quick-add-clear-date"
        :aria-label="$t('todoDetails.clearDate')" @click="clearCustomDate">
        <i class="bi-x" aria-hidden="true"></i>
      </button>
    </div>

    <teleport to="#app-container">
      <div v-if="datePopoverOpen" ref="datePopover" class="quick-add-date-floating" :style="datePopoverStyle">
        <date-picker-popover
          :model-value="resolvedDeadline"
          @select="onPickCustomDate"
          @clear="clearCustomDate" />
      </div>
    </teleport>
  </form>
</template>

<script>
import moment from "moment";
import DatePickerPopover from "./DatePickerPopover.vue";
import { computeQuickDeadline } from "../helpers/taskOperations";

export default {
  name: "QuickAddBar",
  components: { DatePickerPopover },
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
      datePopoverOpen: false,
      datePopoverStyle: {},
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
  beforeUnmount() {
    this.detachPopoverListeners();
  },
  methods: {
    focus() {
      if (this.$refs.input) this.$refs.input.focus();
    },
    selectPreset(preset) {
      this.userTouchedPreset = true;
      this.selectedPreset = preset;
      this.closeDatePopover();
      this.$nextTick(() => this.focus());
    },
    toggleDatePopover() {
      if (this.datePopoverOpen) {
        this.closeDatePopover();
        return;
      }
      const btn = this.$refs.dateBtn;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const width = 264;
      const estimatedHeight = 328;
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left));
      const openAbove = rect.bottom + estimatedHeight > window.innerHeight - 12 && rect.top > estimatedHeight;
      this.datePopoverStyle = openAbove
        ? { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 8}px`, top: "auto" }
        : { left: `${left}px`, top: `${rect.bottom + 8}px`, bottom: "auto" };
      this.datePopoverOpen = true;
      this.$nextTick(() => {
        const popEl = this.$refs.datePopover;
        if (popEl) {
          const actualHeight = popEl.offsetHeight;
          if (!openAbove && rect.bottom + actualHeight + 12 > window.innerHeight && rect.top > actualHeight + 12) {
            this.datePopoverStyle = { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 8}px`, top: "auto" };
          }
        }
        this.attachPopoverListeners();
      });
    },
    closeDatePopover() {
      if (!this.datePopoverOpen) return;
      this.datePopoverOpen = false;
      this.detachPopoverListeners();
    },
    attachPopoverListeners() {
      document.addEventListener("pointerdown", this.onOutsideClick);
      document.addEventListener("keydown", this.onKeyDown);
      window.addEventListener("resize", this.closeDatePopover);
      window.addEventListener("scroll", this.onWindowScroll, true);
    },
    detachPopoverListeners() {
      document.removeEventListener("pointerdown", this.onOutsideClick);
      document.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("resize", this.closeDatePopover);
      window.removeEventListener("scroll", this.onWindowScroll, true);
    },
    onOutsideClick(event) {
      const pop = this.$refs.datePopover;
      const btn = this.$refs.dateBtn;
      if ((pop && pop.contains(event.target)) || (btn && btn.contains(event.target))) return;
      this.closeDatePopover();
    },
    onWindowScroll(event) {
      const pop = this.$refs.datePopover;
      if (pop && (event.target === pop || pop.contains(event.target))) return;
      this.closeDatePopover();
    },
    onKeyDown(event) {
      if (event.key === "Escape") this.closeDatePopover();
    },
    onPickCustomDate(value) {
      if (!value || !moment(value, "YYYY-MM-DD", true).isValid()) return;
      this.userTouchedPreset = true;
      this.customDate = value;
      this.selectedPreset = "custom";
      this.closeDatePopover();
      this.$nextTick(() => this.focus());
    },
    clearCustomDate() {
      this.customDate = "";
      this.selectedPreset = "none";
      this.closeDatePopover();
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
      this.closeDatePopover();
      this.$nextTick(() => this.focus());
    },
  },
};
</script>
