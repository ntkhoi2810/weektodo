<template>
  <div class="modern-date-picker" :class="{ 'is-inline': inline }" role="dialog" :aria-label="$t('quickAdd.pickDate')" @click.stop @wheel.stop>
    <div v-if="showPresets" class="mdp-presets">
      <button type="button" class="mdp-preset-btn" :class="{ active: modelValue === todayIso }" @click="selectIso(todayIso)">
        <i class="bi-sun" aria-hidden="true"></i>
        <span>{{ $t('ui.today') }}</span>
      </button>
      <button type="button" class="mdp-preset-btn" :class="{ active: modelValue === tomorrowIso }" @click="selectIso(tomorrowIso)">
        <i class="bi-sunrise" aria-hidden="true"></i>
        <span>{{ $t('allTasks.tomorrow') }}</span>
      </button>
      <button type="button" class="mdp-preset-btn" :class="{ active: modelValue === nextWeekIso }" @click="selectIso(nextWeekIso)">
        <i class="bi-calendar-range" aria-hidden="true"></i>
        <span>{{ $t('quickMove.nextWeek') }}</span>
      </button>
    </div>

    <div class="mdp-header">
      <strong class="mdp-month-label">{{ grid.monthLabel }}</strong>
      <div class="mdp-nav">
        <button type="button" class="mdp-nav-btn" :aria-label="$t('ui.previousMonth')" @click="shiftMonth(-1)">
          <i class="bi-chevron-left" aria-hidden="true"></i>
        </button>
        <button type="button" class="mdp-nav-btn mdp-today-dot" :title="$t('ui.today')" :aria-label="$t('ui.today')" @click="goToTodayMonth">
          <i class="bi-record-circle" aria-hidden="true"></i>
        </button>
        <button type="button" class="mdp-nav-btn" :aria-label="$t('ui.nextMonth')" @click="shiftMonth(1)">
          <i class="bi-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div class="mdp-grid">
      <span v-for="(dow, idx) in grid.weekdays" :key="idx" class="mdp-dow">{{ dow }}</span>
      <button v-for="day in grid.days" :key="day.iso" type="button" class="mdp-day"
        :class="{
          outside: day.outside,
          today: day.today,
          selected: day.selected,
          'has-tasks': day.hasTasks,
        }"
        :aria-label="day.label"
        :aria-pressed="day.selected"
        @click="selectIso(day.iso)">
        <span>{{ day.dayNumber }}</span>
      </button>
    </div>

    <div v-if="showFooter" class="mdp-footer">
      <button v-if="allowClear" type="button" class="mdp-footer-btn mdp-clear-btn" :disabled="!modelValue" @click="clearDate">
        <i class="bi-x-circle" aria-hidden="true"></i>
        <span>{{ $t('ui.clear') }}</span>
      </button>
      <button type="button" class="mdp-footer-btn mdp-today-btn" @click="selectIso(todayIso)">
        {{ $t('ui.today') }}
      </button>
    </div>
  </div>
</template>

<script>
import moment from "moment";
import { buildCalendarMonthGrid, computeQuickDeadline } from "../helpers/taskOperations";

export default {
  name: "DatePickerPopover",
  props: {
    modelValue: { type: [String, null], default: null },
    inline: { type: Boolean, default: false },
    showPresets: { type: Boolean, default: true },
    showFooter: { type: Boolean, default: true },
    allowClear: { type: Boolean, default: true },
  },
  emits: ["update:modelValue", "select", "clear"],
  data() {
    return {
      monthCursor: this.initialCursor(this.modelValue),
    };
  },
  computed: {
    config() { return this.$store.getters.config || {}; },
    weekStartOnMonday() { return this.config.weekStartOnMonday !== false; },
    language() { return this.config.language || "en"; },
    todayIso() { return moment().format("YYYY-MM-DD"); },
    tomorrowIso() { return moment().add(1, "day").format("YYYY-MM-DD"); },
    nextWeekIso() { return computeQuickDeadline("nextWeek", { weekStartOnMonday: this.weekStartOnMonday }); },
    grid() {
      return buildCalendarMonthGrid(this.monthCursor, {
        selectedIso: this.modelValue,
        weekStartOnMonday: this.weekStartOnMonday,
        language: this.language,
        todoLists: this.$store.getters.todoLists || {},
      });
    },
  },
  watch: {
    modelValue(val) {
      if (val && moment(val, "YYYY-MM-DD", true).isValid()) {
        this.monthCursor = moment(val, "YYYY-MM-DD", true).format("YYYY-MM");
      }
    },
  },
  methods: {
    initialCursor(val) {
      if (val && moment(val, "YYYY-MM-DD", true).isValid()) {
        return moment(val, "YYYY-MM-DD", true).format("YYYY-MM");
      }
      return moment().format("YYYY-MM");
    },
    shiftMonth(offset) {
      this.monthCursor = moment(this.monthCursor, "YYYY-MM", true).add(offset, "months").format("YYYY-MM");
    },
    goToTodayMonth() {
      this.monthCursor = moment().format("YYYY-MM");
    },
    selectIso(iso) {
      this.$emit("update:modelValue", iso);
      this.$emit("select", iso);
    },
    clearDate() {
      this.$emit("update:modelValue", null);
      this.$emit("clear");
    },
  },
};
</script>
