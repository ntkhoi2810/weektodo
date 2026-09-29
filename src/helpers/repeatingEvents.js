import toDoListRepository from "../repositories/toDoListRepository";
import repeatingEventByDateRepository from "../repositories/repeatingEventByDateRepository";
import moment from "moment";
import tasksHelper from "./tasksHelper";
import { normalizeDeadline } from "./deadline";
import notifications from "./notifications";

export default {
  generateRepeatingEventsIntances(listId, vue) {
    let r_events = vue.$store.getters.repeatingEventDateCache[listId] || [];
    r_events.forEach((re_id) => {
      var re = vue.$store.getters.repeatingEventList[re_id];
      var re_by_date = vue.$store.getters.repeatingEventByDate[listId];
      if (!re_by_date[re_id]) {
        var new_instanced_event = JSON.parse(JSON.stringify(re.data));
        normalizeDeadline(new_instanced_event, re.data.listId);
        if (new_instanced_event.deadlineDate) {
          const offset = moment(new_instanced_event.deadlineDate, "YYYY-MM-DD").diff(moment(re.data.listId, "YYYYMMDD"), "days");
          new_instanced_event.deadlineDate = moment(listId, "YYYYMMDD").add(offset, "days").format("YYYY-MM-DD");
        }
        new_instanced_event.listId = listId;
        vue.$store.commit("addTodo", new_instanced_event);

        if(vue.$store.getters.config.autoReorderTasks){
          toDoListRepository.update(listId, tasksHelper.reorderTasksList(vue.$store.getters.todoLists[listId]));
        } else {
          toDoListRepository.update(listId, vue.$store.getters.todoLists[listId]);
        }
        notifications.refreshDayNotifications(vue, listId);
     
        re_by_date[re_id] = true;
        repeatingEventByDateRepository.update(listId, re_by_date);
      }
    });
  },
  removeGeneratedRepeatingEvents(listId, vue) {
    vue.$store.getters.todoLists[listId].forEach((todo, index) => {
      if (todo.repeatingEvent && !vue.$store.getters.repeatingEventList[todo.repeatingEvent]) {
        if (moment(todo.listId).isBefore(Date(), "day")) {
          todo.repeatingEvent = null;
        } else {
          vue.$store.commit("removeTodo", {
            toDoListId: todo.listId,
            index: index,
          });
        }
        toDoListRepository.update(todo.listId, vue.$store.getters.todoLists[todo.listId]);
      }
    });
  },
};
