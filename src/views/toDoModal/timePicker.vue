<template>
  <div ref="picker" class="deadline-picker">
    <button type="button" class="deadline-trigger header-menu-icons" :aria-expanded="open"
      :title="$t('todoDetails.deadline')" @click="open = !open">
      <i :class="date ? 'bi-alarm-fill' : 'bi-alarm'"></i>
      <span v-if="date" class="deadline-trigger-label">{{ shortDate }}<span v-if="time"> · {{ time }}</span></span>
    </button>
    <div v-if="open" class="deadline-popover" role="dialog" :aria-label="$t('todoDetails.deadline')" @keydown.esc.stop="open = false">
      <div class="deadline-popover-title">{{ $t('todoDetails.deadline') }}</div>
      <label class="deadline-field">
        <span>{{ $t('todoDetails.deadlineDate') }}</span>
        <div class="deadline-field-row">
          <input type="date" :value="date || ''" @change="setDate($event.target.value)" />
          <button type="button" :aria-label="$t('todoDetails.clearDate')" :disabled="!date" @click="setDate(null)"><i class="bi-x"></i></button>
        </div>
      </label>
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
  data() { return { open: false, isPm: false, minutes: Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")) }; },
  computed: {
    date() { return this.deadlineDate; },
    time() { return this.deadlineTime; },
    shortDate() { return moment(this.date, "YYYY-MM-DD").locale(this.$store.getters.config.language).format("D MMM"); },
    selectedHour() { return this.time ? Number(this.time.split(":")[0]) % 12 || 12 : null; },
    selectedMinute() { return this.time ? this.time.split(":")[1] : null; },
  },
  watch: { deadlineTime: { immediate: true, handler(time) { if (time) this.isPm = Number(time.split(":")[0]) >= 12; } } },
  mounted() { document.addEventListener("pointerdown", this.onOutsideClick); },
  beforeUnmount() { document.removeEventListener("pointerdown", this.onOutsideClick); },
  methods: {
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
.deadline-popover { position: absolute; right: -42px; top: calc(100% + 12px); z-index: 1080; width: 278px; padding: 16px; border: 1px solid var(--w-line); border-radius: 16px; background: var(--w-surface); color: var(--w-ink); box-shadow: var(--w-shadow); }
.deadline-popover-title { font-weight: 600; margin-bottom: 12px; }
.deadline-field { display: block; margin-bottom: 10px; font-size: 12px; color: var(--w-muted); }
.deadline-field-row { display: flex; align-items: center; gap: 4px; margin-top: 4px; border: 1px solid var(--w-line); border-radius: 9px; padding: 2px 4px 2px 8px; }
.deadline-field-row input { width: 100%; min-width: 0; border: 0; background: transparent; color: var(--w-ink); outline: 0; }
.dark-theme .deadline-field-row input { color-scheme: dark; }
.deadline-field-row button { border: 0; background: transparent; color: var(--w-muted); border-radius: 6px; }
.deadline-field-row button:hover:not(:disabled) { background: var(--w-hover); }
.deadline-field-row button:disabled { opacity: .35; }
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
@media (max-width: 600px) { .deadline-popover { left: 0; right: auto; width: min(278px, calc(100vw - 24px)); } }
</style>
