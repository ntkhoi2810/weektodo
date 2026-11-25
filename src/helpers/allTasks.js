import moment from "moment";
import { normalizeDeadline, isTaskOverdue } from "./deadline";

export function isCalendarListId(listId) {
  return typeof listId === "string" && /^\d{8}$/.test(listId) && moment(listId, "YYYYMMDD", true).isValid();
}

export function collectAllTasks(todoLists, customLists = [], options = {}) {
  const now = options.now ? moment(options.now) : moment();
  const todayIso = now.format("YYYY-MM-DD");
  const customMap = new Map();
  (customLists || []).forEach((list, order) => {
    if (list && list.listId) customMap.set(list.listId, { listName: list.listName || "", order });
  });

  const entries = [];
  Object.entries(todoLists || {}).forEach(([listId, tasks]) => {
    const isCustom = customMap.has(listId);
    const isCalendar = !isCustom && isCalendarListId(listId);
    if (!isCustom && !isCalendar) return;

    const sourceType = isCustom ? "custom" : "calendar";
    const sourceName = isCustom ? customMap.get(listId).listName : listId;
    const calendarIso = isCalendar ? moment(listId, "YYYYMMDD", true).format("YYYY-MM-DD") : null;

    (tasks || []).forEach((rawTask, index) => {
      if (!rawTask || typeof rawTask.text !== "string") return;
      const normalized = { ...rawTask };
      normalizeDeadline(normalized, listId);
      const deadlineDate = normalized.deadlineDate || null;
      const deadlineTime = normalized.deadlineTime || null;
      const effectiveDate = deadlineDate || calendarIso;

      let overdue = false;
      if (!rawTask.checked) {
        if (deadlineDate) {
          overdue = isTaskOverdue(normalized, now);
        } else if (effectiveDate && effectiveDate < todayIso) {
          overdue = true;
        }
      }

      let dueBucket = "noDeadline";
      if (effectiveDate) {
        if (overdue) dueBucket = "overdue";
        else if (effectiveDate === todayIso) dueBucket = "today";
        else if (effectiveDate < todayIso) dueBucket = "overdue";
        else dueBucket = "upcoming";
      }

      entries.push({
        key: `${listId}:${index}`,
        task: rawTask,
        listId,
        index,
        sourceType,
        sourceName,
        deadlineDate,
        deadlineTime,
        effectiveDate,
        isOverdue: overdue,
        dueBucket,
      });
    });
  });

  return entries;
}

export function computeTaskSummary(entries) {
  const summary = {
    total: 0,
    overdue: 0,
    today: 0,
    upcoming: 0,
    noDeadline: 0,
    custom: 0,
    calendar: 0,
  };
  (entries || []).forEach(entry => {
    if (entry.task.checked) return;
    summary.total += 1;
    if (entry.sourceType === "custom") summary.custom += 1;
    else summary.calendar += 1;
    if (entry.dueBucket === "overdue") summary.overdue += 1;
    else if (entry.dueBucket === "today") summary.today += 1;
    else if (entry.dueBucket === "upcoming") summary.upcoming += 1;
    else summary.noDeadline += 1;
  });
  return summary;
}

export function filterAllTasks(entries, filters = {}) {
  const query = (filters.query || "").trim().toLowerCase();
  const bucket = filters.bucket || "all";
  const source = filters.source || "all";
  const color = filters.color || "all";

  return (entries || []).filter(entry => {
    if (source === "custom" && entry.sourceType !== "custom") return false;
    if (source === "calendar" && entry.sourceType !== "calendar") return false;
    if (source !== "all" && source !== "custom" && source !== "calendar" && entry.listId !== source) return false;

    if (color !== "all" && (entry.task.color || "none") !== color) return false;

    if (!entry.task.checked && bucket !== "all" && entry.dueBucket !== bucket) return false;

    if (query) {
      const inText = (entry.task.text || "").toLowerCase().includes(query);
      const inDesc = (entry.task.desc || "").toLowerCase().includes(query);
      const inSource = (entry.sourceName || "").toLowerCase().includes(query);
      const inSubtasks = (entry.task.subTaskList || []).some(sub => (sub.text || "").toLowerCase().includes(query));
      if (!inText && !inDesc && !inSource && !inSubtasks) return false;
    }

    return true;
  });
}

function compareEntries(a, b) {
  const aDate = a.effectiveDate || "9999-99-99";
  const bDate = b.effectiveDate || "9999-99-99";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  const aTime = a.deadlineTime || "99:99";
  const bTime = b.deadlineTime || "99:99";
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return (a.task.text || "").localeCompare(b.task.text || "");
}

export function groupAllTasksByDeadline(entries, now = moment()) {
  const current = moment(now);
  const todayIso = current.format("YYYY-MM-DD");
  const tomorrowIso = current.clone().add(1, "day").format("YYYY-MM-DD");

  const overdue = [];
  const today = [];
  const tomorrow = [];
  const futureByDate = new Map();
  const noDeadline = [];
  const completed = [];

  (entries || []).forEach(entry => {
    if (entry.task.checked) {
      completed.push(entry);
      return;
    }
    if (!entry.effectiveDate) {
      noDeadline.push(entry);
    } else if (entry.dueBucket === "overdue") {
      overdue.push(entry);
    } else if (entry.effectiveDate === todayIso) {
      today.push(entry);
    } else if (entry.effectiveDate === tomorrowIso) {
      tomorrow.push(entry);
    } else {
      if (!futureByDate.has(entry.effectiveDate)) futureByDate.set(entry.effectiveDate, []);
      futureByDate.get(entry.effectiveDate).push(entry);
    }
  });

  const groups = [];
  if (overdue.length) groups.push({ key: "overdue", kind: "overdue", date: null, tasks: overdue.sort(compareEntries) });
  if (today.length) groups.push({ key: todayIso, kind: "today", date: todayIso, tasks: today.sort(compareEntries) });
  if (tomorrow.length) groups.push({ key: tomorrowIso, kind: "tomorrow", date: tomorrowIso, tasks: tomorrow.sort(compareEntries) });

  [...futureByDate.keys()].sort().forEach(date => {
    groups.push({ key: date, kind: "date", date, tasks: futureByDate.get(date).sort(compareEntries) });
  });

  if (noDeadline.length) groups.push({ key: "noDeadline", kind: "noDeadline", date: null, tasks: noDeadline.sort(compareEntries) });

  return { groups, completed };
}

export function groupAllTasksByList(entries, customLists = []) {
  const completed = [];
  const byList = new Map();

  (entries || []).forEach(entry => {
    if (entry.task.checked) {
      completed.push(entry);
      return;
    }
    if (!byList.has(entry.listId)) byList.set(entry.listId, []);
    byList.get(entry.listId).push(entry);
  });

  const groups = [];
  const customOrder = new Map();
  (customLists || []).forEach((list, index) => {
    if (list && list.listId) customOrder.set(list.listId, { name: list.listName || "", order: index });
  });

  const customKeys = [];
  const calendarKeys = [];
  byList.forEach((_, listId) => {
    if (customOrder.has(listId)) customKeys.push(listId);
    else calendarKeys.push(listId);
  });

  customKeys.sort((a, b) => customOrder.get(a).order - customOrder.get(b).order);
  calendarKeys.sort();

  customKeys.forEach(listId => {
    groups.push({
      key: `list:${listId}`,
      kind: "custom",
      listId,
      name: customOrder.get(listId).name,
      tasks: byList.get(listId).sort(compareEntries),
    });
  });

  calendarKeys.forEach(listId => {
    groups.push({
      key: `calendar:${listId}`,
      kind: "calendar",
      listId,
      name: listId,
      tasks: byList.get(listId).sort(compareEntries),
    });
  });

  return { groups, completed };
}
