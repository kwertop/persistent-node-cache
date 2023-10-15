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

export class PersistentNodeCache extends NodeCache {
    private readonly interval: NodeJS.Timeout;
    private readonly cacheName: string;
    private readonly emitter: EventEmitter;
    private readonly backupFilePath: string;
    private readonly appendFilePath: string;
    private flushingToDisk: boolean;
    private appendFileDescriptor: any;

    constructor(cacheName: string, period: number, dir?: string, opts?: any) {
        super(opts);
        this.cacheName = cacheName;
        this.interval = setInterval(() => { this.saveToDisk() }, period);
        this.emitter = new EventEmitter();
        this.flushingToDisk = false;
        if(dir?.endsWith('/')) {
            dir = dir.slice(0,-1);
        }
        this.backupFilePath = (dir || os.homedir()) + `/${cacheName}.backup`;
        this.appendFilePath = (dir || os.homedir()) + `/${cacheName}.append`;
        const file = fs.createWriteStream(this.appendFilePath);
        file.end();
        super.on("expired", (key, _) => { this.appendExpiredEvent(key) });
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
        let bf = Buffer.from(JSON.stringify(item) + '\n');
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
        let bf = Buffer.from(JSON.stringify(item) + '\n');
        this.appendToFile(this.appendFilePath, bf);
        return super.mset(keyValueSet)
    }

    public override del(keys: Key | Key[]): number {
        if (this.flushingToDisk) {
            waitFor('done', this.emitter, () => { this.del(keys); });
            return 0;
        }
        let item: CmdItem = { cmd: 'del', key: keys};
        let bf = Buffer.from(JSON.stringify(item) + '\n');
        this.appendToFile(this.appendFilePath, bf);
        return super.del(keys)
    }

    public override take<T>(key: Key): T | undefined {
        if (this.flushingToDisk) {
            waitFor('done', this.emitter, () => { this.take(key); });
            return;
        }
        let item: CmdItem = { cmd: 'del', key: key};
        let bf = Buffer.from(JSON.stringify(item) + '\n');
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
        let bf = Buffer.from(JSON.stringify(item) + '\n');
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

    public async recover() {
        const backup = fs.readFileSync(this.backupFilePath);
        const data = JSON.parse(backup.toString());
        super.mset(data);
        const fileStream = fs.createReadStream(this.appendFilePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        for await (const line of rl) {
            let m = super.keys();
            let data = JSON.parse(line.toString());
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
        }
    }

    private appendExpiredEvent(key: Key) {
        let item: CmdItem = { cmd: 'del', key: key};
        let bf = Buffer.from(JSON.stringify(item) + '\n');
        this.appendToFile(this.appendFilePath, bf);
    }

    private saveToDisk(): void {
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
            let bf = Buffer.from(JSON.stringify(data));
            fs.writeFileSync(this.backupFilePath, bf);
            fs.writeFileSync(this.appendFilePath, '');

            fs.close(this.appendFileDescriptor, (closeErr) => {
                if(closeErr) {
                    console.error('Error closing file:', closeErr);
                }
            });
        }
        catch(err: any) {
            //
        }
        finally {
            this.flushingToDisk = false;
            this.emitter.emit('done');
        }
    }

    private appendToFile(fileName: string, data: Buffer): void {
        const flags = fs.constants.O_WRONLY | fs.constants.O_DIRECT;
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