import NodeCache, { Key, ValueSetItem } from "node-cache";
export default class PersistentNodeCache extends NodeCache {
    private readonly interval;
    private readonly cacheName;
    private readonly emitter;
    private readonly backupFilePath;
    private readonly appendFilePath;
    private flushingToDisk;
    private appendFileDescriptor;
    constructor(cacheName: string, period?: number, dir?: string, opts?: any);
    set<T>(key: Key, value: T, ttl?: number | string): boolean;
    mset<T>(keyValueSet: ValueSetItem<T>[]): boolean;
    del(keys: Key | Key[]): number;
    take<T>(key: Key): T | undefined;
    ttl(key: Key, ttl?: number): boolean;
    flushAll(): void;
    close(): void;
    recover(): Promise<void>;
    private appendExpiredEvent;
    private saveToDisk;
    private appendToFile;
}
