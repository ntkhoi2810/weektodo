<template>
  <div ref="picker" class="deadline-picker">
    <button type="button" class="deadline-trigger header-menu-icons" :aria-expanded="open"
      :title="$t('todoDetails.deadline')" @click="toggleOpen">
      <i :class="date ? 'bi-alarm-fill' : 'bi-alarm'"></i>
      <span v-if="date" class="deadline-trigger-label">{{ shortDate }}<span v-if="time"> · {{ time }}</span></span>
    </button>
    <div v-if="open" class="deadline-popover" role="dialog" :aria-label="$t('todoDetails.deadline')" @keydown.esc.stop="open = false">
      <div class="deadline-popover-title">{{ $t('todoDetails.deadline') }}</div>
      <div class="deadline-field">
        <span>{{ $t('todoDetails.deadlineDate') }}</span>
        <div class="deadline-field-row deadline-date-trigger-row">
          <button type="button" class="deadline-date-toggle" :aria-expanded="calendarOpen" @click="calendarOpen = !calendarOpen">
            <i class="bi-calendar-event" aria-hidden="true"></i>
            <span>{{ formattedFullDate }}</span>
            <i :class="calendarOpen ? 'bi-chevron-up' : 'bi-chevron-down'" class="deadline-date-caret" aria-hidden="true"></i>
          </button>
          <button type="button" :aria-label="$t('todoDetails.clearDate')" :disabled="!date" @click="setDate(null)">
            <i class="bi-x"></i>
          </button>
        </div>
        <div v-if="calendarOpen" class="deadline-inline-calendar">
          <div class="mdp-presets">
            <button type="button" class="mdp-preset-btn" :class="{ active: date === todayIso }" @click="chooseDate(todayIso)">
              <i class="bi-sun" aria-hidden="true"></i>
              <span>{{ $t('ui.today') }}</span>
            </button>
            <button type="button" class="mdp-preset-btn" :class="{ active: date === tomorrowIso }" @click="chooseDate(tomorrowIso)">
              <i class="bi-sunrise" aria-hidden="true"></i>
              <span>{{ $t('allTasks.tomorrow') }}</span>
            </button>
          </div>
          <div class="mdp-header">
            <strong class="mdp-month-label">{{ monthLabel }}</strong>
            <div class="mdp-nav">
              <button type="button" class="mdp-nav-btn" :aria-label="$t('ui.previousMonth')" @click="shiftMonth(-1)">
                <i class="bi-chevron-left" aria-hidden="true"></i>
              </button>
              <button type="button" class="mdp-nav-btn" :aria-label="$t('ui.today')" @click="goToTodayMonth">
                <i class="bi-record-circle" aria-hidden="true"></i>
              </button>
              <button type="button" class="mdp-nav-btn" :aria-label="$t('ui.nextMonth')" @click="shiftMonth(1)">
                <i class="bi-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="mdp-grid">
            <span v-for="(dow, idx) in weekdays" :key="idx" class="mdp-dow">{{ dow }}</span>
            <button v-for="day in calendarDays" :key="day.iso" type="button" class="mdp-day"
              :class="{ outside: day.outside, today: day.today, selected: day.selected }"
              :aria-label="day.label" :aria-pressed="day.selected"
              @click="chooseDate(day.iso)">
              <span>{{ day.dayNumber }}</span>
            </button>
          </div>
        </div>
      </div>
      <label class="deadline-field">
        <span>{{ $t('todoDetails.deadlineTime') }}</span>
        <div class="deadline-field-row">
          <input type="time" :value="time || ''" @change="setTime($event.target.value)" />
          <button type="button" :aria-label="$t('todoDetails.clearTime')" :disabled="!time" @click="setTime(null)"><i class="bi-x"></i></button>
        </div>
      </label>
      <div class="clock-heading">
        <span>{{ $t('todoDetails.chooseHour') }}</span>
        <div class="clock-period">
          <button type="button" :class="{ active: !isPm }" @click="setPeriod(false)">AM</button>
          <button type="button" :class="{ active: isPm }" @click="setPeriod(true)">PM</button>
        </div>
      </div>
      <div class="clock-hours" role="group" :aria-label="$t('todoDetails.chooseHour')">
        <span class="clock-face-center" aria-hidden="true">{{ time || '--:--' }}</span>
        <button v-for="hour in 12" :key="hour" type="button" :class="{ active: selectedHour === hour }"
          :style="hourStyle(hour)" @click="chooseHour(hour)">{{ hour }}</button>
      </div>
      <div class="clock-heading">{{ $t('todoDetails.chooseMinute') }}</div>
      <div class="clock-minutes" role="group" :aria-label="$t('todoDetails.chooseMinute')">
        <button v-for="minute in minutes" :key="minute" type="button" :class="{ active: selectedMinute === minute }"
          @click="chooseMinute(minute)">{{ minute }}</button>
      </div>
      <div class="clock-hint">{{ $t('todoDetails.exactTimeHint') }}</div>
    </div>
  </div>
</template>

<script>
import moment from "moment";

export default {
  name: "timePicker",
  emits: ["deadline-selected"],
  props: {
    deadlineDate: { type: [String, null], default: null },
    deadlineTime: { type: [String, null], default: null },
  },
  data() {
    return {
      open: false,
      calendarOpen: false,
      monthCursor: moment().startOf("month"),
      isPm: false,
      minutes: Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")),
    };
  },
  computed: {
    config() { return (this.$store && this.$store.getters && this.$store.getters.config) || {}; },
    language() { return this.config.language || "en"; },
    weekStartOnMonday() { return this.config.weekStartOnMonday !== false; },
    date() { return this.deadlineDate; },
    time() { return this.deadlineTime; },
    todayIso() { return moment().format("YYYY-MM-DD"); },
    tomorrowIso() { return moment().add(1, "day").format("YYYY-MM-DD"); },
    shortDate() { return moment(this.date, "YYYY-MM-DD").locale(this.language).format("D MMM"); },
    formattedFullDate() {
      if (!this.date) return this.$t("quickAdd.pickDate");
      return moment(this.date, "YYYY-MM-DD").locale(this.language).format("LL");
    },
    monthLabel() {
      return this.monthCursor.clone().locale(this.language).format("MMMM YYYY");
    },
    weekdays() {
      const firstDay = this.weekStartOnMonday ? 1 : 0;
      const base = this.monthCursor.clone().startOf("month");
      base.subtract((base.day() - firstDay + 7) % 7, "days");
      return Array.from({ length: 7 }, (_, i) => base.clone().add(i, "days").locale(this.language).format("dd"));
    },
    calendarDays() {
      const firstDay = this.weekStartOnMonday ? 1 : 0;
      const start = this.monthCursor.clone().startOf("month");
      start.subtract((start.day() - firstDay + 7) % 7, "days");
      const end = this.monthCursor.clone().endOf("month");
      const count = Math.ceil((end.diff(start, "days") + 1) / 7) * 7;
      const todayIso = this.todayIso;
      return Array.from({ length: count }, (_, i) => {
        const d = start.clone().add(i, "days");
        const iso = d.format("YYYY-MM-DD");
        return {
          iso,
          dayNumber: d.date(),
          label: d.clone().locale(this.language).format("LL"),
          outside: !d.isSame(this.monthCursor, "month"),
          today: iso === todayIso,
          selected: iso === this.date,
        };
      });
    },
    selectedHour() { return this.time ? Number(this.time.split(":")[0]) % 12 || 12 : null; },
    selectedMinute() { return this.time ? this.time.split(":")[1] : null; },
  },
  watch: {
    deadlineTime: {
      immediate: true,
      handler(time) { if (time) this.isPm = Number(time.split(":")[0]) >= 12; },
    },
    deadlineDate: {
      immediate: true,
      handler(date) {
        if (date && moment(date, "YYYY-MM-DD", true).isValid()) {
          this.monthCursor = moment(date, "YYYY-MM-DD", true).startOf("month");
        }
      },
    },
  },
  mounted() { document.addEventListener("pointerdown", this.onOutsideClick); },
  beforeUnmount() { document.removeEventListener("pointerdown", this.onOutsideClick); },
  methods: {
    toggleOpen() {
      this.open = !this.open;
      if (this.open) {
        this.calendarOpen = !this.date;
        this.monthCursor = this.date && moment(this.date, "YYYY-MM-DD", true).isValid()
          ? moment(this.date, "YYYY-MM-DD", true).startOf("month")
          : moment().startOf("month");
      }
    },
    shiftMonth(offset) {
      this.monthCursor = this.monthCursor.clone().add(offset, "months");
    },
    goToTodayMonth() {
      this.monthCursor = moment().startOf("month");
    },
    chooseDate(iso) {
      this.setDate(iso);
      this.calendarOpen = false;
    },
    onOutsideClick(event) { if (this.$refs.picker && !this.$refs.picker.contains(event.target)) this.open = false; },
    emitDeadline(date, time) { this.$emit("deadline-selected", { date, time }); },
    setDate(value) { this.emitDeadline(value || null, this.time); },
    setTime(value) { this.emitDeadline(this.date, value || null); },
    setPeriod(pm) {
      this.isPm = pm;
      if (this.time) this.chooseHour(this.selectedHour);
    },
    chooseHour(hour) {
      const hour24 = hour % 12 + (this.isPm ? 12 : 0);
      const minute = this.time ? this.time.split(":")[1] : "00";
      this.setTime(`${String(hour24).padStart(2, "0")}:${minute}`);
    },
    chooseMinute(minute) {
      const hour24 = this.time ? this.time.split(":")[0] : String(this.isPm ? 12 : 0).padStart(2, "0");
      this.setTime(`${hour24}:${minute}`);
    },
    hourStyle(hour) {
      const angle = (hour * 30 - 90) * Math.PI / 180;
      return { left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 40 * Math.sin(angle)}%` };
    },
  },
};
</script>

<style scoped>
.deadline-picker { position: relative; }
.deadline-trigger { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: inherit; white-space: nowrap; }
.deadline-trigger-label { font-size: 11px; }
.deadline-popover { position: absolute; right: -42px; top: calc(100% + 12px); z-index: 1080; width: 286px; max-height: min(520px, calc(100vh - 40px)); overflow-y: auto; scrollbar-width: thin; padding: 16px; border: 1px solid var(--w-line); border-radius: 18px; background: var(--w-surface); color: var(--w-ink); box-shadow: 0 20px 48px -14px rgba(0,0,0,.3); }
.deadline-popover-title { font-weight: 600; margin-bottom: 12px; }
.deadline-field { display: block; margin-bottom: 10px; font-size: 12px; color: var(--w-muted); }
.deadline-field-row { display: flex; align-items: center; gap: 4px; margin-top: 4px; border: 1px solid var(--w-line); border-radius: 10px; padding: 3px 4px 3px 8px; background: var(--w-hover); }
.deadline-field-row:focus-within { border-color: var(--w-soft); background: var(--w-surface); }
.deadline-field-row input { width: 100%; min-width: 0; border: 0; background: transparent; color: var(--w-ink); outline: 0; }
.dark-theme .deadline-field-row input { color-scheme: dark; }
.deadline-field-row button { border: 0; background: transparent; color: var(--w-muted); border-radius: 6px; }
.deadline-field-row button:hover:not(:disabled) { background: var(--w-hover); color: var(--w-ink); }
.deadline-field-row button:disabled { opacity: .35; }
.deadline-date-toggle { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; padding: 3px 2px; text-align: left; font-size: 12.5px; color: var(--w-ink) !important; }
.deadline-date-toggle span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.deadline-date-caret { font-size: 11px; color: var(--w-soft); }
.deadline-inline-calendar { margin-top: 8px; padding: 10px; border: 1px solid var(--w-line); border-radius: 14px; background: var(--w-surface); }
.clock-heading { display: flex; align-items: center; justify-content: space-between; margin: 11px 0 7px; color: var(--w-muted); font-size: 11px; }
.clock-period { display: flex; gap: 2px; }
.clock-period button, .clock-hours button, .clock-minutes button { border: 0; background: transparent; color: var(--w-muted); border-radius: 8px; }
.clock-period button { padding: 2px 6px; }
.clock-hours { position: relative; width: 180px; height: 180px; margin: 0 auto 8px; border: 1px solid var(--w-line); border-radius: 50%; background: var(--w-hover); }
.clock-hours button { position: absolute; transform: translate(-50%, -50%); width: 28px; height: 28px; font-size: 12px; }
.clock-face-center { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: var(--w-soft); font-size: 15px; font-variant-numeric: tabular-nums; }
.clock-minutes { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
.clock-minutes button { height: 30px; font-size: 12px; }
.clock-period button:hover, .clock-hours button:hover, .clock-minutes button:hover { background: var(--w-hover); }
.clock-period button.active, .clock-hours button.active, .clock-minutes button.active { background: var(--w-ink); color: var(--w-surface); }
.clock-hint { margin-top: 10px; color: var(--w-soft); font-size: 11px; }
@media (max-width: 600px) { .deadline-popover { left: 0; right: auto; width: min(286px, calc(100vw - 24px)); } }
</style>
