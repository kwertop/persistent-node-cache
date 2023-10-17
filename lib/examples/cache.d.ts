export declare class LocalCache {
    private static cache;
    private constructor();
    static InitiateInstance(): void;
    static get(key: string): any;
    static set(key: string, value: any, ttl?: number): void;
    static del(key: string): void;
    static getTtl(key: string): number | undefined;
    static recover(): void;
    private static createNodeCacheInstance;
    private static getTtlWithJitter;
    static flushAll(): Promise<void>;
}
