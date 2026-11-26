import moment from "moment";

export function normalizeDeadline(task, listId) {
  let changed = false;
  if (task.deadlineDate === undefined) {
    const scheduled = moment(listId, "YYYYMMDD", true);
    task.deadlineDate = task.time && scheduled.isValid() ? scheduled.format("YYYY-MM-DD") : null;
    changed = true;
  }
  if (task.deadlineTime === undefined) {
    task.deadlineTime = task.time || null;
    changed = true;
  }
  return changed;
}

export function deadlineMoment(task) {
  if (!task.deadlineDate || !task.deadlineTime) return null;
  const dateTime = moment(`${task.deadlineDate} ${task.deadlineTime}`, "YYYY-MM-DD HH:mm", true);
  return dateTime.isValid() ? dateTime : null;
}

export function isDateOverdue(dateStr, now = moment()) {
  if (!dateStr) return false;
  const date = moment(dateStr, "YYYY-MM-DD", true);
  if (!date.isValid()) return false;
  return date.isBefore(moment(now).startOf("day"));
}

export function isTaskOverdue(task, now = moment()) {
  if (!task || task.checked || !task.deadlineDate) return false;
  const current = moment(now);
  if (task.deadlineTime) {
    const dt = deadlineMoment(task);
    if (dt) return dt.isBefore(current);
  }
  return isDateOverdue(task.deadlineDate, current);
}

export function groupTasksByDeadline(tasks, options = {}) {
  const preserveManualOrder = !!(options && options.preserveManualOrder);
  const dated = new Map();
  const noDeadline = [];
  const completed = [];
  tasks.forEach((task, index) => {
    const entry = { task, index };
    if (task.checked) completed.push(entry);
    else if (!task.deadlineDate) noDeadline.push(entry);
    else {
      if (!dated.has(task.deadlineDate)) dated.set(task.deadlineDate, []);
      dated.get(task.deadlineDate).push(entry);
    }
  });
  const groups = [...dated.keys()].sort().map(date => {
    const items = dated.get(date);
    if (!preserveManualOrder) {
      items.sort((a, b) => (a.task.deadlineTime || "99:99").localeCompare(b.task.deadlineTime || "99:99"));
    }
    return { date, tasks: items };
  });
  return { groups, noDeadline, completed };
}
