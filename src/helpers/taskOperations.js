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

export function isTaskDragEvent(event) {
  const types = event && event.dataTransfer && event.dataTransfer.types;
  if (!types) return false;
  const list = Array.from(types);
  return list.includes("application/x-weektodo-task") || list.includes("item");
}

export function setDragPayload(event, { toDo, index, listId }) {
  if (!event || !event.dataTransfer) return;
  const normalizedListId = listId || (toDo && toDo.listId) || "";
  const normalizedIndex = Number(index);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-weektodo-task", JSON.stringify({
    listId: normalizedListId,
    index: normalizedIndex,
    toDo,
  }));
  event.dataTransfer.setData("item", JSON.stringify(toDo));
  event.dataTransfer.setData("index", String(normalizedIndex));
}

export function getDragPayload(event) {
  const dt = event && event.dataTransfer;
  if (!dt) return null;
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
    return null;
  }
  return null;
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
