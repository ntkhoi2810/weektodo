import moment from "moment";

export function isCalendarListId(listId) {
  return typeof listId === "string" && /^\d{8}$/.test(listId) && moment(listId, "YYYYMMDD", true).isValid();
}

export function computeReorderIndex(fromIndex, targetIndex, position = "before") {
  const from = Number(fromIndex);
  const target = Number(targetIndex);
  if (!Number.isInteger(from) || from < 0 || !Number.isInteger(target) || target < 0) {
    return { moved: false, insertIndex: -1 };
  }
  const desired = position === "after" ? target + 1 : target;
  if (from === desired || from + 1 === desired) {
    return { moved: false, insertIndex: from };
  }
  const insertIndex = from < desired ? desired - 1 : desired;
  return { moved: true, insertIndex };
}

export function computeCrossListIndex(targetIndex, position = "before", targetLength = 0) {
  const target = Number(targetIndex);
  const length = Math.max(0, Number(targetLength) || 0);
  if (!Number.isInteger(target) || target < 0) return length;
  const raw = position === "after" ? target + 1 : target;
  return Math.max(0, Math.min(length, raw));
}

export function computeDropPosition(event) {
  const el = event && event.currentTarget;
  if (!el || typeof el.getBoundingClientRect !== "function") return "before";
  const rect = el.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

let activeDragPayload = null;

export function isTaskDragEvent(event) {
  if (activeDragPayload !== null) return true;
  const types = event && event.dataTransfer && event.dataTransfer.types;
  if (!types) return false;
  const list = Array.from(types).map(t => String(t).toLowerCase());
  return list.includes("application/x-weektodo-task") || list.includes("item") || list.includes("text/plain");
}

export function setDragPayload(event, { toDo, index, listId }) {
  const normalizedListId = listId || (toDo && toDo.listId) || "";
  const normalizedIndex = Number(index);
  activeDragPayload = {
    listId: normalizedListId,
    index: normalizedIndex,
    toDo: toDo || null,
  };
  if (!event || !event.dataTransfer) return;
  event.dataTransfer.effectAllowed = "move";
  const serialized = JSON.stringify(activeDragPayload);
  event.dataTransfer.setData("application/x-weektodo-task", serialized);
  event.dataTransfer.setData("item", JSON.stringify(toDo));
  event.dataTransfer.setData("index", String(normalizedIndex));
}

export function clearDragPayload() {
  activeDragPayload = null;
}

export function getDragPayload(event) {
  const dt = event && event.dataTransfer;
  if (dt && typeof dt.getData === "function") {
    try {
      const rawRich = dt.getData("application/x-weektodo-task");
      if (rawRich) {
        const parsed = JSON.parse(rawRich);
        const index = Number(parsed.index);
        if (parsed && parsed.listId && Number.isInteger(index) && index >= 0) {
          return { listId: parsed.listId, index, toDo: parsed.toDo || null };
        }
      }
      const rawItem = dt.getData("item");
      const rawIndex = dt.getData("index");
      if (rawItem && rawIndex !== "") {
        const toDo = JSON.parse(rawItem);
        const index = Number(rawIndex);
        if (toDo && toDo.listId && Number.isInteger(index) && index >= 0) {
          return { listId: toDo.listId, index, toDo };
        }
      }
    } catch (e) {
      // fall through to activeDragPayload
    }
  }
  if (activeDragPayload && activeDragPayload.listId && Number.isInteger(activeDragPayload.index) && activeDragPayload.index >= 0) {
    return { ...activeDragPayload };
  }
  return null;
}

export function reorderGroupTasks(groupEntries, fromGroupIndex, targetGroupIndex, position = "before") {
  const entries = Array.isArray(groupEntries) ? groupEntries : [];
  const { moved, insertIndex } = computeReorderIndex(fromGroupIndex, targetGroupIndex, position);
  if (!moved || fromGroupIndex >= entries.length || targetGroupIndex >= entries.length) {
    return { moved: false, reordered: entries, affectedListIds: [], sameListReorder: null };
  }
  const movedEntry = entries[fromGroupIndex];
  const targetEntry = entries[targetGroupIndex];
  const reordered = [...entries];
  reordered.splice(fromGroupIndex, 1);
  reordered.splice(insertIndex, 0, movedEntry);
  reordered.forEach((entry, idx) => {
    if (entry && entry.task) {
      entry.task.manualOrder = idx;
    }
  });
  let sameListReorder = null;
  if (movedEntry && targetEntry && movedEntry.listId === targetEntry.listId) {
    const sameList = computeReorderIndex(movedEntry.index, targetEntry.index, position);
    if (sameList.moved) {
      sameListReorder = {
        listId: movedEntry.listId,
        fromIndex: movedEntry.index,
        toIndex: sameList.insertIndex,
      };
    }
  }
  const affectedListIds = [...new Set(reordered.map(entry => entry && entry.listId).filter(Boolean))];
  return { moved: true, reordered, affectedListIds, sameListReorder };
}

export function computeQuickDeadline(preset, options = {}) {
  const now = options.now ? moment(options.now) : moment();
  const weekStartOnMonday = options.weekStartOnMonday !== false;
  if (preset === "none" || !preset) return null;
  if (preset === "today") return now.clone().format("YYYY-MM-DD");
  if (preset === "tomorrow") return now.clone().add(1, "day").format("YYYY-MM-DD");
  if (preset === "nextWeek") {
    const firstDay = weekStartOnMonday ? 1 : 0;
    const weekStart = now.clone().startOf("day").subtract((now.day() - firstDay + 7) % 7, "days");
    return weekStart.add(7, "days").format("YYYY-MM-DD");
  }
  return moment(preset, "YYYY-MM-DD", true).isValid() ? preset : null;
}

export function computeNextWeekListId(options = {}) {
  const iso = computeQuickDeadline("nextWeek", options);
  return moment(iso, "YYYY-MM-DD", true).format("YYYYMMDD");
}

export function createTaskObject(text, { listId, deadlineDate = null, deadlineTime = null } = {}) {
  return {
    text,
    checked: false,
    listId,
    desc: "",
    subTaskList: [],
    color: "none",
    priority: 0,
    tags: [],
    time: null,
    deadlineDate: deadlineDate || null,
    deadlineTime: deadlineTime || null,
    alarm: false,
    repeatingEvent: null,
  };
}

export function buildMovePatch(task, toListId) {
  if (!task || !isCalendarListId(toListId)) return {};
  if (!task.deadlineDate) return {};
  const targetIso = moment(toListId, "YYYYMMDD", true).format("YYYY-MM-DD");
  if (task.deadlineDate < targetIso) {
    return { deadlineDate: targetIso };
  }
  return {};
}

export function buildCalendarMonthGrid(monthCursor, options = {}) {
  const weekStartOnMonday = options.weekStartOnMonday !== false;
  const language = options.language || "en";
  const selectedIso = options.selectedIso || null;
  const today = options.now ? moment(options.now).startOf("day") : moment().startOf("day");
  const todayIso = today.format("YYYY-MM-DD");
  const todoLists = options.todoLists || {};

  const baseMonth = monthCursor && moment(monthCursor, ["YYYY-MM-DD", "YYYY-MM", "YYYYMMDD"], true).isValid()
    ? moment(monthCursor, ["YYYY-MM-DD", "YYYY-MM", "YYYYMMDD"], true).startOf("month")
    : (selectedIso && moment(selectedIso, "YYYY-MM-DD", true).isValid()
      ? moment(selectedIso, "YYYY-MM-DD", true).startOf("month")
      : today.clone().startOf("month"));

  const firstDay = weekStartOnMonday ? 1 : 0;
  const start = baseMonth.clone().subtract((baseMonth.day() - firstDay + 7) % 7, "days");
  const end = baseMonth.clone().endOf("month");
  const cellCount = Math.ceil((end.diff(start, "days") + 1) / 7) * 7;

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    start.clone().add(i, "days").locale(language).format("dd")
  );

  const days = Array.from({ length: cellCount }, (_, i) => {
    const date = start.clone().add(i, "days");
    const iso = date.format("YYYY-MM-DD");
    const listId = date.format("YYYYMMDD");
    const listTasks = todoLists[listId] || [];
    const hasTasks = listTasks.some(t => t && !t.checked);
    return {
      iso,
      listId,
      dayNumber: date.date(),
      label: date.clone().locale(language).format("LL"),
      outside: !date.isSame(baseMonth, "month"),
      today: iso === todayIso,
      selected: iso === selectedIso,
      hasTasks,
    };
  });

  return {
    monthKey: baseMonth.format("YYYY-MM"),
    monthLabel: baseMonth.clone().locale(language).format("MMMM YYYY"),
    weekdays,
    days,
  };
}
