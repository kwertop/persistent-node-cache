import { PersistentNodeCache } from "./persistentNodeCache";

const cacheExpirySeconds = {"HALF_HOUR": 1800, "FIFTEEN_MINUTES": 900};

export class LocalCache {
  private static cache : PersistentNodeCache;

  private constructor() {

  }

  public static InitiateInstance() {
    if (!LocalCache.cache) {
      LocalCache.createNodeCacheInstance();
    }
  }

  static get(key: string) :any {
    return LocalCache.cache.get(key);
  }

  static set(key: string, value: any, ttl?: number) {
    if (ttl) {
      LocalCache.cache.set(key, value, LocalCache.getTtlWithJitter(ttl));
    } else {
      LocalCache.cache.set(key, value);
    }
  }

  static del(key: string) {
    LocalCache.cache.del(key);
  }

  static getTtl(key: string) {
    return LocalCache.cache.getTtl(key)
  }

  static recover() {
    LocalCache.cache.recover();
  }

  private static createNodeCacheInstance() {
    const expirySeconds = cacheExpirySeconds.HALF_HOUR;
    const checkExpiredKeysSeconds = cacheExpirySeconds.FIFTEEN_MINUTES;
    LocalCache.cache = new PersistentNodeCache("mycache", 10000, "", {stdTTL : expirySeconds, checkperiod : checkExpiredKeysSeconds});
  }

  /*
  **  InMemory cache expiry with random jitter in seconds
  **  add a random 10% extra seconds to initial expiry seconds
  */
  private static getTtlWithJitter(expirySeconds: number) : number {
    const maxTimeJitterSeconds = Math.round(expirySeconds * 0.1);
    return expirySeconds + Math.floor(Math.random() * maxTimeJitterSeconds);
  }

  static async flushAll() {
    await LocalCache.cache.flushAll();
  }

}