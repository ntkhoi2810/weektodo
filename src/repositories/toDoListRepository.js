import dbRepository from "./dbRepository";

export default {
  update(toDoListId, toDoList) {
    let db_req = dbRepository.open();
    db_req.onsuccess = function (event) {
      let db = event.target.result;
      const request = dbRepository.update(db, "todo_lists", toDoListId, toDoList);
      request.onsuccess = () => db.close();
      request.onerror = () => db.close();
    };
  },
  remove(toDoListId) {
    return new Promise(resolve => {
      let db_req = dbRepository.open();
      db_req.onsuccess = function (event) {
        let db = event.target.result;
        const request = dbRepository.delete(db, "todo_lists", toDoListId);
        request.onsuccess = () => { db.close(); resolve(); };
        request.onerror = () => { db.close(); resolve(); };
      };
      db_req.onerror = () => resolve();
    });
  },
};
