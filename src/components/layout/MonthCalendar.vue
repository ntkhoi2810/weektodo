<template>
  <section class="month-calendar" :aria-label="monthLabel">
    <div class="month-calendar-grid" :style="{ '--month-weeks': dates.length / 7 }">
      <div v-for="(label, index) in weekdays" :key="index" class="month-weekday">{{ label }}</div>
      <div v-for="date in dates" :key="date" class="month-cell" :class="{ outside: !isInMonth(date), today: date === todayKey }">
        <button type="button" class="month-day-number" :aria-label="dayLabel(date)" @click="$emit('focus-day', date)">{{ dayNumber(date) }}</button>
        <div class="month-cell-tasks">
          <button v-for="(entry, index) in visibleEntries(date)" :key="index" type="button"
            class="month-task" :title="entry.task.text" :style="taskStyle(entry.task)"
            @click="$emit('open-task', entry)">
            <span v-if="entry.task.deadlineTime" class="month-task-time">{{ entry.task.deadlineTime }}</span>
            <span class="month-task-title">{{ entry.task.text }}</span>
          </button>
          <button v-if="!printing && (entries[isoDate(date)] || []).length > 3" type="button" class="month-more"
            :aria-expanded="expandedDate === date" @click="expandedDate = expandedDate === date ? null : date">
            {{ expandedDate === date ? $t('ui.less') : `+${entries[isoDate(date)].length - 3} ${$t('ui.more')}` }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import moment from "moment";
import dbRepository from "../../repositories/dbRepository";
import { monthDays, monthDeadlineEntries } from "../../helpers/monthCalendar";

export default {
  name: "MonthCalendar",
  props: { selectedDate: { type: String, required: true }, todayKey: { type: String, required: true } },
  emits: ["focus-day", "open-task"],
  data() { return { storedLists: {}, generatedByDate: {}, expandedDate: null, loadGeneration: 0, printing: false }; },
  computed: {
    config() { return this.$store.getters.config; },
    dates() { return monthDays(this.selectedDate, this.config.weekStartOnMonday); },
    monthLabel() { return moment(this.selectedDate, "YYYYMMDD").locale(this.config.language).format("MMMM YYYY"); },
    weekdays() {
      return this.dates.slice(0, 7).map(date => moment(date, "YYYYMMDD").locale(this.config.language).format("ddd"));
    },
    lists() { return { ...this.storedLists, ...this.$store.getters.todoLists }; },
    entries() {
      return monthDeadlineEntries(this.lists, this.$store.getters.repeatingEventList,
        this.generatedByDate, this.dates);
    },
  },
  watch: {
    selectedDate() { this.expandedDate = null; this.loadData(); },
  },
  mounted() {
    this.loadData();
    window.addEventListener("beforeprint", this.beforePrint);
    window.addEventListener("afterprint", this.afterPrint);
  },
  beforeUnmount() {
    window.removeEventListener("beforeprint", this.beforePrint);
    window.removeEventListener("afterprint", this.afterPrint);
  },
  methods: {
    isoDate(date) { return moment(date, "YYYYMMDD").format("YYYY-MM-DD"); },
    dayNumber(date) { return moment(date, "YYYYMMDD").date(); },
    dayLabel(date) { return moment(date, "YYYYMMDD").locale(this.config.language).format("LL"); },
    isInMonth(date) { return date.slice(0, 6) === this.selectedDate.slice(0, 6); },
    visibleEntries(date) {
      const entries = this.entries[this.isoDate(date)] || [];
      return this.printing || this.expandedDate === date ? entries : entries.slice(0, 3);
    },
    beforePrint() { this.printing = true; },
    afterPrint() { this.printing = false; },
    taskStyle(task) { return task.color && task.color !== "none" ? { '--month-task-color': task.color } : {}; },
    loadData() {
      const generation = ++this.loadGeneration;
      const request = dbRepository.open();
      request.onsuccess = event => {
        const db = event.target.result;
        const lists = {};
        const generated = {};
        let remaining = 2;
        const finish = () => {
          if (--remaining === 0) {
            db.close();
            if (generation === this.loadGeneration) {
              this.storedLists = lists;
              this.generatedByDate = generated;
            }
          }
        };
        const read = (table, target) => {
          const cursorRequest = dbRepository.selectAll(db, table);
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor) { target[cursor.key] = cursor.value; cursor.continue(); }
            else finish();
          };
          cursorRequest.onerror = finish;
        };
        read("todo_lists", lists);
        read("repeating_events_by_date", generated);
      };
    },
  },
};
</script>
