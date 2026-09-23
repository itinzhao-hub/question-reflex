const QR_DB = (() => {
  const DB_NAME = "questionReflexDB";
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains("trials")) {
          const trials = db.createObjectStore("trials", {
            keyPath: "id",
            autoIncrement: true
          });
          trials.createIndex("sessionId", "sessionId", { unique: false });
          trials.createIndex("timestamp", "timestamp", { unique: false });
          trials.createIndex("family", "family", { unique: false });
          trials.createIndex("audioProfile", "audioProfile", { unique: false });
          trials.createIndex("speedClass", "speedClass", { unique: false });
        }

        if (!db.objectStoreNames.contains("sessions")) {
          const sessions = db.createObjectStore("sessions", {
            keyPath: "id"
          });
          sessions.createIndex("startedAt", "startedAt", { unique: false });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return dbPromise;
  }

  async function put(storeName, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function add(storeName, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).add(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function get(storeName, key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearStore(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearAll() {
    await clearStore("trials");
    await clearStore("sessions");
  }

  return {
    open,
    addTrial: trial => add("trials", trial),
    getAllTrials: () => getAll("trials"),
    putSession: session => put("sessions", session),
    getSession: id => get("sessions", id),
    getAllSessions: () => getAll("sessions"),
    clearAll
  };
})();
