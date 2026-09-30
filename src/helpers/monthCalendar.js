import moment from "moment";
import { rrulestr } from "rrule";
import { normalizeDeadline } from "./deadline";

export function monthDays(selectedDate, weekStartsMonday) {
  const month = moment(selectedDate, "YYYYMMDD", true).startOf("month");
  const firstDay = weekStartsMonday ? 1 : 0;
  const start = month.clone().subtract((month.day() - firstDay + 7) % 7, "days");
  const end = month.clone().endOf("month");
  const count = Math.ceil((end.diff(start, "days") + 1) / 7) * 7;
  return Array.from({ length: count }, (_, index) => start.clone().add(index, "days").format("YYYYMMDD"));
}

export function monthDeadlineEntries(lists, repeatingEvents, generatedByDate, dates) {
  const first = moment(dates[0], "YYYYMMDD").format("YYYY-MM-DD");
  const last = moment(dates[dates.length - 1], "YYYYMMDD").format("YYYY-MM-DD");
  const entries = {};
  const existingOccurrences = new Set();
  const add = (date, entry) => {
    if (!entries[date]) entries[date] = [];
    entries[date].push(entry);
  };

  Object.entries(lists).forEach(([listId, tasks]) => {
    (tasks || []).forEach((rawTask, index) => {
      const task = { ...rawTask };
      normalizeDeadline(task, listId);
      if (task.repeatingEvent) existingOccurrences.add(`${listId}:${task.repeatingEvent}`);
      const date = task.deadlineDate;
      if (task.checked || !date || date < first || date > last || !moment(date, "YYYY-MM-DD", true).isValid()) return;
      add(date, { task, listId, index, virtual: false });
    });
  });

  Object.values(repeatingEvents || {}).forEach(event => {
    if (!event || !event.data || !event.repeating_rule) return;
    const source = { ...event.data };
    normalizeDeadline(source, source.listId);
    if (source.checked || !source.deadlineDate) return;
    const origin = moment(source.listId, "YYYYMMDD", true);
    const deadline = moment(source.deadlineDate, "YYYY-MM-DD", true);
    if (!origin.isValid() || !deadline.isValid()) return;
    const offset = deadline.diff(origin, "days");
    const occurrenceStart = moment(first, "YYYY-MM-DD").subtract(offset, "days");
    const occurrenceEnd = moment(last, "YYYY-MM-DD").subtract(offset, "days");
    let occurrences;
    try {
      occurrences = rrulestr(event.repeating_rule).between(
        occurrenceStart.clone().startOf("day").toDate(),
        occurrenceEnd.clone().endOf("day").toDate(), true
      );
    } catch (error) {
      return;
    }
    occurrences.forEach(occurrence => {
      const listId = moment.utc(occurrence).format("YYYYMMDD");
      const date = moment(listId, "YYYYMMDD").add(offset, "days").format("YYYY-MM-DD");
      if (date < first || date > last || existingOccurrences.has(`${listId}:${event.id}`) ||
        (generatedByDate[listId] && generatedByDate[listId][event.id])) return;
      add(date, { task: { ...source, deadlineDate: date, listId, repeatingEvent: event.id },
        listId, virtual: true, repeatingEventId: event.id });
    });
  });

  Object.values(entries).forEach(day => day.sort((a, b) =>
    (a.task.deadlineTime || "99:99").localeCompare(b.task.deadlineTime || "99:99") ||
    a.task.text.localeCompare(b.task.text)));
  return entries;
}
