import moment from "moment";
import dbRepository from "../repositories/dbRepository";
import { normalizeDeadline, deadlineMoment } from "./deadline";

let refreshGeneration = 0;

export default {
  refreshDayNotifications(vue) {
    const generation = ++refreshGeneration;
    vue.$store.getters.notifications.forEach(clearTimeout);
    vue.$store.commit("setNotificatios", []);
    const dbRequest = dbRepository.open();
    dbRequest.onsuccess = event => {
      const db = event.target.result;
      const lists = {};
      const request = dbRepository.selectAll(db, "todo_lists");
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          lists[cursor.key] = cursor.value;
          cursor.continue();
          return;
        }
        db.close();
        if (generation !== refreshGeneration) return;
        Object.assign(lists, vue.$store.getters.todoLists);
        const now = moment();
        const timers = [];
        Object.keys(lists).forEach(listId => {
          (lists[listId] || []).forEach(rawTask => {
            const task = { ...rawTask };
            normalizeDeadline(task, listId);
            const deadline = deadlineMoment(task);
            if (!task.alarm || task.checked || !deadline || !deadline.isSame(now, "day") || !deadline.isAfter(now)) return;
            timers.push(this.createNotificationAlert(deadline, task.text, vue.$store.getters.config.notificationSound));
          });
        });
        vue.$store.commit("setNotificatios", timers);
      };
    };
  },
  createNotificationAlert(deadline, todoText, notificationSound) {
    return setTimeout(() => {
      this.createNotification(deadline.format("LT"), todoText, notificationSound);
    }, deadline.diff(moment()));
  },
  createNotification(header, body, notificationSound) {
    new Notification(header, {
      body: body,
      icon: "/icon-mono.png",
      silent: true,
    });
    this.playNotificationSound(notificationSound);
  },
  playNotificationSound(notificationSound) {
    var sound;
    switch (notificationSound) {
      case "pop":
        sound = new Audio("sounds/pop-alert.ogg");
        break;
      case "positive":
        sound = new Audio("sounds/positive.ogg");
        break;
      case "bell":
        sound = new Audio("sounds/loud-bell.ogg");
        break;
      case "soft":
        sound = new Audio("sounds/soft.ogg");
        break;
      case "tiny":
        sound = new Audio("sounds/tiny.ogg");
        break;
      case "piano":
        sound = new Audio("sounds/piano.ogg");
        break;
      case "soft-bell":
        sound = new Audio("sounds/soft-bell.ogg");
        break;
      case "metal":
        sound = new Audio("sounds/metal-gear.ogg");
        break;
      case "none":
        return;
    }
    sound.addEventListener("canplaythrough", () => {
      sound.play();
    });
  },
};
