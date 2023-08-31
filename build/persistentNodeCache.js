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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistentNodeCache = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const events_1 = require("events");
const waitFor_1 = require("./waitFor");
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
class PersistentNodeCache extends node_cache_1.default {
    constructor(cacheName, period, opts) {
        super(opts);
        this.cacheName = cacheName;
        this.interval = setInterval(() => { this.saveToDisk(); }, period);
        this.emitter = new events_1.EventEmitter();
        this.flushingToDisk = false;
        super.on("expired", (key, _) => { this.appendExpiredEvent(key); });
    }
    set(key, value, ttl) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.set(key, value, ttl); });
        }
        let retVal;
        if (ttl) {
            retVal = super.set(key, value, ttl);
        }
        else {
            retVal = super.set(key, value);
        }
        let item = { cmd: 'set', key: key, val: value, ttl: ttl };
        let bf = Buffer.from(JSON.stringify(item) + '\n');
        fs_1.default.appendFileSync(`/Users/rahulsharma/${this.cacheName}.append`, bf);
        return retVal;
    }
    mset(keyValueSet) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.mset(keyValueSet); });
        }
        let item = { cmd: 'mset', keyValue: keyValueSet };
        let bf = Buffer.from(JSON.stringify(item) + '\n');
        fs_1.default.appendFileSync(`/Users/rahulsharma/${this.cacheName}.append`, bf);
        return super.mset(keyValueSet);
    }
    del(keys) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.del(keys); });
        }
        let item = { cmd: 'del', key: keys };
        let bf = Buffer.from(JSON.stringify(item) + '\n');
        fs_1.default.appendFileSync(`/Users/rahulsharma/${this.cacheName}.append`, bf);
        return super.del(keys);
    }
    take(key) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.take(key); });
        }
        let item = { cmd: 'del', key: key };
        let bf = Buffer.from(JSON.stringify(item) + '\n');
        fs_1.default.appendFileSync(`/Users/rahulsharma/${this.cacheName}.append`, bf);
        return super.take(key);
    }
    ttl(key, ttl) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.ttl(key, ttl); });
        }
        let retVal;
        if (ttl) {
            retVal = super.ttl(key, ttl);
        }
        else {
            retVal = super.ttl(key);
        }
        let item = { cmd: 'ttl', key: key, ttl: ttl };
        let bf = Buffer.from(JSON.stringify(item) + '\n');
        fs_1.default.appendFileSync(`/Users/rahulsharma/${this.cacheName}.append`, bf);
        return retVal;
    }
    flushAll() {
        return super.flushAll();
    }
    recover() {
        const _super = Object.create(null, {
            mset: { get: () => super.mset },
            set: { get: () => super.set },
            del: { get: () => super.del },
            ttl: { get: () => super.ttl }
        });
        var _a, e_1, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const backup = fs_1.default.readFileSync(`/Users/rahulsharma/${this.cacheName}.backup`);
            const data = JSON.parse(backup.toString());
            _super.mset.call(this, data);
            const fileStream = fs_1.default.createReadStream(`/Users/rahulsharma/${this.cacheName}.append`);
            const rl = readline_1.default.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            try {
                for (var _d = true, rl_1 = __asyncValues(rl), rl_1_1; rl_1_1 = yield rl_1.next(), _a = rl_1_1.done, !_a; _d = true) {
                    _c = rl_1_1.value;
                    _d = false;
                    const line = _c;
                    let data = JSON.parse(line.toString());
                    switch (data['cmd']) {
                        case 'set':
                            _super.set.call(this, data['key'], data['val'], data['ttl']);
                            break;
                        case 'mset':
                            _super.mset.call(this, data['keyValue']);
                            break;
                        case 'del':
                            _super.del.call(this, data['key']);
                            break;
                        case 'ttl':
                            _super.ttl.call(this, data['key'], data['ttl']);
                            break;
                        default:
                            break;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = rl_1.return)) yield _b.call(rl_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    appendExpiredEvent(key) {
        let item = { cmd: 'del', key: key };
        let bf = Buffer.from(JSON.stringify(item) + '\n');
        fs_1.default.appendFileSync(`/Users/rahulsharma/${this.cacheName}.append`, bf);
    }
    saveToDisk() {
        this.flushingToDisk = true;
        let data = new Array();
        let keys = super.keys();
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let item = {
                key: key,
                val: super.get(key),
                ttl: super.getTtl(key)
            };
            data.push(item);
        }
        let bf = Buffer.from(JSON.stringify(data));
        fs_1.default.writeFileSync(`/Users/rahulsharma/${this.cacheName}.backup`, bf);
        fs_1.default.writeFileSync(`/Users/rahulsharma/${this.cacheName}.append`, '');
        this.flushingToDisk = false;
        this.emitter.emit('done');
    }
}
exports.PersistentNodeCache = PersistentNodeCache;
