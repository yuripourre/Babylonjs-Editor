export declare class WorkerTools {
    /**
     * Adds a new worker and waits for its initialization.
     * @param jsPath defines the name of the JS file to load for the worker.
     */
    static AddWorker(jsPath: string): Promise<Worker>;
    /**
     * Computes the given function id in the worker.
     * @param worker defines the reference to the worker.
     * @param functionId defines the id of the message or function to compute.
     * @param message defines the data of the message to send.
     */
    static Compute<T>(worker: Worker, functionId: string, message: any): Promise<T>;
}
