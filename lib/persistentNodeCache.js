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
const node_cache_1 = __importDefault(require("node-cache"));
const events_1 = require("events");
const waitFor_1 = require("./waitFor");
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
const os_1 = __importDefault(require("os"));
class PersistentNodeCache extends node_cache_1.default {
    constructor(cacheName, period, dir, opts, encoder, decoder) {
        super(opts);
        this.cacheName = cacheName;
        this.interval = setInterval(() => { this.saveToDisk(); }, period || 1000);
        this.emitter = new events_1.EventEmitter();
        this.flushingToDisk = false;
        if (dir === null || dir === void 0 ? void 0 : dir.endsWith('/')) {
            dir = dir.slice(0, -1);
        }
        this.backupFilePath = (dir || os_1.default.homedir()) + `/${this.cacheName}.backup`;
        this.appendFilePath = (dir || os_1.default.homedir()) + `/${this.cacheName}.append`;
        fs_1.default.writeFileSync(this.appendFilePath, '');
        this.encoder = encoder;
        this.decoder = decoder;
        super.on("expired", (key, _) => { this.appendExpiredEvent(key); });
    }
    set(key, value, ttl) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.set(key, value, ttl); });
            return false;
        }
        let retVal;
        if (ttl) {
            retVal = super.set(key, value, ttl);
        }
        else {
            retVal = super.set(key, value);
        }
        let item = { cmd: 'set', key: key, val: value, ttl: ttl };
        let bf = this.toBuffer(item);
        // fs.appendFileSync(this.appendFilePath, bf);
        this.appendToFile(this.appendFilePath, bf);
        return retVal;
    }
    mset(keyValueSet) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.mset(keyValueSet); });
            return false;
        }
        let item = { cmd: 'mset', keyValue: keyValueSet };
        let bf = this.toBuffer(item);
        this.appendToFile(this.appendFilePath, bf);
        return super.mset(keyValueSet);
    }
    del(keys) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.del(keys); });
            return 0;
        }
        let item = { cmd: 'del', key: keys };
        let bf = this.toBuffer(item);
        this.appendToFile(this.appendFilePath, bf);
        return super.del(keys);
    }
    take(key) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.take(key); });
            return;
        }
        let item = { cmd: 'del', key: key };
        let bf = this.toBuffer(item);
        this.appendToFile(this.appendFilePath, bf);
        return super.take(key);
    }
    ttl(key, ttl) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.ttl(key, ttl); });
            return false;
        }
        let retVal;
        if (ttl) {
            retVal = super.ttl(key, ttl);
        }
        else {
            retVal = super.ttl(key);
        }
        let item = { cmd: 'ttl', key: key, ttl: ttl };
        let bf = this.toBuffer(item);
        this.appendToFile(this.appendFilePath, bf);
        return retVal;
    }
    flushAll() {
        return super.flushAll();
    }
    close() {
        super.close();
        clearInterval(this.interval);
    }
    recover() {
        const _super = Object.create(null, {
            mset: { get: () => super.mset },
            keys: { get: () => super.keys },
            set: { get: () => super.set },
            del: { get: () => super.del },
            ttl: { get: () => super.ttl }
        });
        var _a, e_1, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const backup = fs_1.default.readFileSync(this.backupFilePath);
            let data = this.fromBuffer(backup);
            _super.mset.call(this, data);
            const fileStream = fs_1.default.createReadStream(this.appendFilePath);
            const rl = readline_1.default.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            try {
                for (var _d = true, rl_1 = __asyncValues(rl), rl_1_1; rl_1_1 = yield rl_1.next(), _a = rl_1_1.done, !_a; _d = true) {
                    _c = rl_1_1.value;
                    _d = false;
                    const line = _c;
                    let m = _super.keys.call(this);
                    let data = this.fromBuffer(Buffer.from(line));
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
    fromBuffer(bf) {
        let data;
        if (this.decoder) {
            data = this.decoder(bf);
        }
        else {
            data = JSON.parse(bf.toString());
        }
        return data;
    }
    toBuffer(item) {
        let bf;
        if (this.encoder) {
            bf = this.encoder(item);
        }
        else {
            bf = Buffer.from(JSON.stringify(item) + '\n');
        }
        return bf;
    }
    appendExpiredEvent(key) {
        let item = { cmd: 'del', key: key };
        let bf = this.toBuffer(item);
        this.appendToFile(this.appendFilePath, bf);
    }
    saveToDisk() {
        this.flushingToDisk = true;
        try {
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
            let bf = this.toBuffer(data);
            fs_1.default.writeFileSync(this.backupFilePath, bf);
            fs_1.default.writeFileSync(this.appendFilePath, '');
            this.appendFileDescriptor.close();
        }
        catch (err) {
            //
        }
        finally {
            this.flushingToDisk = false;
            this.emitter.emit('done');
        }
    }
    appendToFile(fileName, data) {
        const flags = fs_1.default.constants.O_WRONLY | fs_1.default.constants.O_DIRECT | fs_1.default.constants.O_APPEND;
        const mode = 0o666;
        if (this.appendFileDescriptor) {
            fs_1.default.write(this.appendFileDescriptor, data, 0, data.length, null, (writeErr, written, buffer) => {
                if (writeErr) {
                    console.error('Error writing to file:', writeErr);
                }
            });
            return;
        }
        fs_1.default.open(fileName, flags, mode, (err, fd) => {
            if (err) {
                console.error('Error opening file:', err);
                return;
            }
            this.appendFileDescriptor = fd;
            fs_1.default.write(fd, data, 0, data.length, null, (writeErr, written, buffer) => {
                if (writeErr) {
                    console.error('Error writing to file:', writeErr);
                }
            });
        });
    }
}
exports.default = PersistentNodeCache;
