import NodeCache, { Key, ValueSetItem } from "node-cache";
import {EventEmitter} from 'events';
import { waitFor } from "./waitFor";
import fs from "fs";
import readline from "readline";
import os from "os";

type CmdItem<T = any> = {
    cmd: string
    key?: Key | Key[];
    val?: T;
    ttl?: number | string;
    keyValue?: ValueSetItem<T>[];
}

export type CacheSerializer = {
    serialize: Function;
    deserialize: Function;
}

export default class PersistentNodeCache extends NodeCache {
    private readonly interval: NodeJS.Timeout;
    private readonly cacheName: string;
    private readonly emitter: EventEmitter;
    private readonly backupFilePath: string;
    private readonly appendFilePath: string;
    private flushingToDisk: boolean;
    private appendFileDescriptor: any;
    private serializer: CacheSerializer;
    private changesSinceLastBackup: boolean;

    constructor(cacheName: string, period?: number, dir?: string, opts?: any, serializer?: CacheSerializer) {
        super(opts);
        this.cacheName = cacheName;
        this.emitter = new EventEmitter();
        this.flushingToDisk = false;
        if(dir?.endsWith('/')) {
            dir = dir.slice(0,-1);
        }
        this.backupFilePath = (dir || os.homedir()) + `/${this.cacheName}.backup`;
        this.appendFilePath = (dir || os.homedir()) + `/${this.cacheName}.append`;

        if(serializer) {
            this.serializer = serializer;
        }
        else {
            const customSerializer: CacheSerializer = {
                serialize: (item: any) => {
                    return Buffer.from(JSON.stringify(item) + '\n'); 
                },
                deserialize: (bf: Buffer) => {
                    return JSON.parse(bf.toString());
                }
            }
            this.serializer = customSerializer;
        }
        this.changesSinceLastBackup = false;
        super.on("expired", (key, _) => { this.appendExpiredEvent(key) });

        // Look for backup and append files and recover if found. Otherwise create them
        try {
            fs.accessSync(this.backupFilePath, fs.constants.R_OK | fs.constants.W_OK);
            fs.accessSync(this.appendFilePath, fs.constants.R_OK | fs.constants.W_OK);
            this.recover();
        } catch (err) {
            fs.writeFileSync(this.backupFilePath, '');
            fs.writeFileSync(this.appendFilePath, '');
        }
        // Need to start the interval after we recover the files otherwise they get erased
        this.interval = setInterval(() => { this.saveToDisk() }, period || 1000);
    }

    public override set<T>(key: Key, value: T, ttl?: number | string): boolean {
        if (this.flushingToDisk) {
            waitFor('done', this.emitter, () => { this.set(key, value, ttl); });
            return false;
        }
        let retVal: boolean;
        if (ttl) {
            retVal = super.set(key, value, ttl)
        } else {
            retVal = super.set(key, value)
        }
        let item: CmdItem = { cmd: 'set', key: key, val: value, ttl: ttl};
        let bf: Buffer = this.serializer.serialize(item);
        // fs.appendFileSync(this.appendFilePath, bf);
        this.appendToFile(this.appendFilePath, bf);
        return retVal;
    }

    public override mset<T>(keyValueSet: ValueSetItem<T>[]): boolean {
        if (this.flushingToDisk) {
            waitFor('done', this.emitter, () => { this.mset(keyValueSet); });
            return false;
        }
        let item: CmdItem = { cmd: 'mset', keyValue: keyValueSet};
        let bf: Buffer = this.serializer.serialize(item);
        this.appendToFile(this.appendFilePath, bf);
        return super.mset(keyValueSet)
    }

    public override del(keys: Key | Key[]): number {
        if (this.flushingToDisk) {
            waitFor('done', this.emitter, () => { this.del(keys); });
            return 0;
        }
        let item: CmdItem = { cmd: 'del', key: keys};
        let bf: Buffer = this.serializer.serialize(item);
        this.appendToFile(this.appendFilePath, bf);
        return super.del(keys)
    }

    public override take<T>(key: Key): T | undefined {
        if (this.flushingToDisk) {
            waitFor('done', this.emitter, () => { this.take(key); });
            return;
        }
        let item: CmdItem = { cmd: 'del', key: key};
        let bf: Buffer = this.serializer.serialize(item);
        this.appendToFile(this.appendFilePath, bf);
        return super.take(key);
    }

    public override ttl(key: Key, ttl?: number): boolean {
        if (this.flushingToDisk) {
            waitFor('done', this.emitter, () => { this.ttl(key, ttl); });
            return false;
        }
        let retVal: boolean;
        if (ttl) {
            retVal = super.ttl(key, ttl);
        } else {
            retVal = super.ttl(key)
        }
        let item: CmdItem = { cmd: 'ttl', key: key, ttl: ttl};
        let bf: Buffer = this.serializer.serialize(item);
        this.appendToFile(this.appendFilePath, bf);
        return retVal;
    }

    public override flushAll(): void {
        return super.flushAll();
    }

    public override close() {
        super.close();
        clearInterval(this.interval);
    }

    public recover() {
        const backup = fs.readFileSync(this.backupFilePath);
        if(backup.length > 0) {
            let data: any = this.serializer.deserialize(backup);
            super.mset(data);
        }
        const appendData = fs.readFileSync(this.appendFilePath, 'utf-8');
        appendData.split(/\r?\n/).forEach((line) => {
            let data: any = this.serializer.deserialize(line);
            switch(data['cmd']) {
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

    private appendExpiredEvent(key: Key) {
        let item: CmdItem = { cmd: 'del', key: key};
        let bf: Buffer = this.serializer.serialize(item);
        this.appendToFile(this.appendFilePath, bf);
    }

    private saveToDisk(): void {
        if(!this.changesSinceLastBackup) {
            return;
        }

        this.flushingToDisk = true;
        try {
            let data: Array<ValueSetItem> = new Array<ValueSetItem>();
            let keys = super.keys();
            for(let i=0; i<keys.length; i++) {
                let key = keys[i];
                let item: ValueSetItem = {
                    key: key,
                    val: super.get(key),
                    ttl: super.getTtl(key)
                }
                data.push(item)
            }
            let bf = this.serializer.serialize(data);
            fs.writeFileSync(this.backupFilePath, bf);
            fs.writeFileSync(this.appendFilePath, '');
            this.appendFileDescriptor.close();
        }
        catch(err: any) {
            //
        }
        finally {
            this.flushingToDisk = false;
            this.changesSinceLastBackup = false;
            this.emitter.emit('done');
        }
    }

    private appendToFile(fileName: string, data: Buffer): void {
        this.changesSinceLastBackup = true;
        const flags = fs.constants.O_WRONLY | fs.constants.O_DIRECT | fs.constants.O_APPEND;
        const mode = 0o666;

        if(this.appendFileDescriptor) {
            fs.write(this.appendFileDescriptor, data, 0, data.length, null, (writeErr, written, buffer) => {
                if (writeErr) {
                    console.error('Error writing to file:', writeErr);
                }
            });
            return;
        }
        fs.open(fileName, flags, mode, (err, fd) => {
            if (err) {
                console.error('Error opening file:', err);
                return;
            }
            this.appendFileDescriptor = fd;
            fs.write(fd, data, 0, data.length, null, (writeErr, written, buffer) => {
                if (writeErr) {
                    console.error('Error writing to file:', writeErr);
                }
            });            
        });
    }
}

