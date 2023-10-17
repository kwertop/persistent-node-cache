"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalCache = void 0;
const persistentNodeCache_1 = __importDefault(require("../persistentNodeCache"));
const cacheExpirySeconds = { "HALF_HOUR": 1800, "FIFTEEN_MINUTES": 900 };
class LocalCache {
    constructor() {
    }
    static InitiateInstance() {
        if (!LocalCache.cache) {
            LocalCache.createNodeCacheInstance();
        }
    }
    static get(key) {
        return LocalCache.cache.get(key);
    }
    static set(key, value, ttl) {
        if (ttl) {
            LocalCache.cache.set(key, value, LocalCache.getTtlWithJitter(ttl));
        }
        else {
            LocalCache.cache.set(key, value);
        }
    }
    static del(key) {
        LocalCache.cache.del(key);
    }
    static getTtl(key) {
        return LocalCache.cache.getTtl(key);
    }
    static recover() {
        LocalCache.cache.recover();
    }
    static createNodeCacheInstance() {
        const expirySeconds = cacheExpirySeconds.HALF_HOUR;
        const checkExpiredKeysSeconds = cacheExpirySeconds.FIFTEEN_MINUTES;
        LocalCache.cache = new persistentNodeCache_1.default("mycache", 10000, "", { stdTTL: expirySeconds, checkperiod: checkExpiredKeysSeconds });
    }
    /*
    **  InMemory cache expiry with random jitter in seconds
    **  add a random 10% extra seconds to initial expiry seconds
    */
    static getTtlWithJitter(expirySeconds) {
        const maxTimeJitterSeconds = Math.round(expirySeconds * 0.1);
        return expirySeconds + Math.floor(Math.random() * maxTimeJitterSeconds);
    }
    static flushAll() {
        return __awaiter(this, void 0, void 0, function* () {
            yield LocalCache.cache.flushAll();
        });
    }
}
exports.LocalCache = LocalCache;
