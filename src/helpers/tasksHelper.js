export default {
  pendingTasksCount(todoList) {
    if (todoList == null || typeof(todoList) === "undefined") return 0;
    return todoList.filter((todo) => !todo.checked).length;
  },
  reorderTasksList(toDoList) {
    var array = toDoList;
    array.sort(function (a, b) {
      if (b.checked != a.checked) {
        if (b.checked) return -1;
        if (a.checked) return 1;
      }
      const aDeadline = a.deadlineDate ? `${a.deadlineDate} ${a.deadlineTime || "23:59"}` : null;
      const bDeadline = b.deadlineDate ? `${b.deadlineDate} ${b.deadlineTime || "23:59"}` : null;
      if (aDeadline !== bDeadline) {
        if (!aDeadline) return 1;
        if (!bDeadline) return -1;
        return aDeadline.localeCompare(bDeadline);
      }
    });
    return array;
  },
};
