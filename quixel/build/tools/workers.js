"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerTools = void 0;
const posix_1 = require("path/posix");
class WorkerTools {
    /**
     * Adds a new worker and waits for its initialization.
     * @param jsPath defines the name of the JS file to load for the worker.
     */
    static AddWorker(jsPath) {
        return new Promise((resolve) => {
            const worker = new Worker((0, posix_1.join)(__dirname, "workers", jsPath));
            let initializeFn;
            worker.addEventListener("message", (initializeFn = (ev) => {
                if (ev.data !== "initialized") {
                    return;
                }
                worker.removeEventListener("message", initializeFn);
                resolve(worker);
            }));
        });
    }
    /**
     * Computes the given function id in the worker.
     * @param worker defines the reference to the worker.
     * @param functionId defines the id of the message or function to compute.
     * @param message defines the data of the message to send.
     */
    static Compute(worker, functionId, message) {
        return new Promise((resolve) => {
            let initializeFn;
            worker.addEventListener("message", (initializeFn = (ev) => {
                if (ev.data.id !== functionId) {
                    return;
                }
                worker.removeEventListener("message", initializeFn);
                resolve(ev.data.result);
            }));
            worker.postMessage({
                id: functionId,
                ...message,
            });
        });
    }
}
exports.WorkerTools = WorkerTools;
//# sourceMappingURL=workers.js.map