"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cache_1 = __importDefault(require("node-cache"));
const events_1 = require("events");
const waitFor_1 = require("./waitFor");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
class PersistentNodeCache extends node_cache_1.default {
    constructor(cacheName, period, dir, opts, serializer) {
        super(opts);
        this.cacheName = cacheName;
        this.emitter = new events_1.EventEmitter();
        this.flushingToDisk = false;
        if (dir === null || dir === void 0 ? void 0 : dir.endsWith('/')) {
            dir = dir.slice(0, -1);
        }
        this.backupFilePath = (dir || os_1.default.homedir()) + `/${this.cacheName}.backup`;
        this.appendFilePath = (dir || os_1.default.homedir()) + `/${this.cacheName}.append`;
        if (serializer) {
            this.serializer = serializer;
        }
        else {
            const customSerializer = {
                serialize: (item) => {
                    return Buffer.from(JSON.stringify(item) + '\n');
                },
                deserialize: (bf) => {
                    return JSON.parse(bf.toString());
                }
            };
            this.serializer = customSerializer;
        }
        this.changesSinceLastBackup = false;
        super.on("expired", (key, _) => { this.appendExpiredEvent(key); });
        // Look for backup and append files and recover if found. Otherwise create them
        try {
            fs_1.default.accessSync(this.backupFilePath, fs_1.default.constants.R_OK | fs_1.default.constants.W_OK);
            fs_1.default.accessSync(this.appendFilePath, fs_1.default.constants.R_OK | fs_1.default.constants.W_OK);
            this.recover();
        }
        catch (err) {
            fs_1.default.writeFileSync(this.backupFilePath, '');
            fs_1.default.writeFileSync(this.appendFilePath, '');
        }
        // Need to start the interval after we recover the files otherwise they get erased
        this.interval = setInterval(() => { this.saveToDisk(); }, period || 1000);
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
        let bf = this.serializer.serialize(item);
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
        let bf = this.serializer.serialize(item);
        this.appendToFile(this.appendFilePath, bf);
        return super.mset(keyValueSet);
    }
    del(keys) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.del(keys); });
            return 0;
        }
        let item = { cmd: 'del', key: keys };
        let bf = this.serializer.serialize(item);
        this.appendToFile(this.appendFilePath, bf);
        return super.del(keys);
    }
    take(key) {
        if (this.flushingToDisk) {
            (0, waitFor_1.waitFor)('done', this.emitter, () => { this.take(key); });
            return;
        }
        let item = { cmd: 'del', key: key };
        let bf = this.serializer.serialize(item);
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
        let bf = this.serializer.serialize(item);
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
        const backup = fs_1.default.readFileSync(this.backupFilePath);
        if (backup.length > 0) {
            let data = this.serializer.deserialize(backup);
            super.mset(data);
        }
        const appendData = fs_1.default.readFileSync(this.appendFilePath, 'utf-8');
        appendData.split(/\r?\n/).forEach((line) => {
            let data = this.serializer.deserialize(line);
            switch (data['cmd']) {
                case 'set':
                    super.set(data['key'], data['val'], data['ttl']);
                    break;
                case 'mset':
                    super.mset(data['keyValue']);
                    break;
                case 'del':
                    super.del(data['key']);
                    break;
                case 'ttl':
                    super.ttl(data['key'], data['ttl']);
                    break;
                default:
                    break;
            }
        });
    }
    appendExpiredEvent(key) {
        let item = { cmd: 'del', key: key };
        let bf = this.serializer.serialize(item);
        this.appendToFile(this.appendFilePath, bf);
    }
    saveToDisk() {
        if (!this.changesSinceLastBackup) {
            return;
        }
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
            let bf = this.serializer.serialize(data);
            fs_1.default.writeFileSync(this.backupFilePath, bf);
            fs_1.default.writeFileSync(this.appendFilePath, '');
            this.appendFileDescriptor.close();
        }
        catch (err) {
            //
        }
        finally {
            this.flushingToDisk = false;
            this.changesSinceLastBackup = false;
            this.emitter.emit('done');
        }
    }
    appendToFile(fileName, data) {
        this.changesSinceLastBackup = true;
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
