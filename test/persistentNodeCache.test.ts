import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import PersistentNodeCache, { CacheSerializer } from "../src/persistentNodeCache";
const fs = require('fs');
import {EventEmitter} from 'events';
import os from "os";

describe("persistentNodeCache", () => {
    beforeEach(() => {
        jest.mock('fs');
    });

    it('should set the key-value', () => {
        fs.write = jest.fn();
        let cache = new PersistentNodeCache("mycache", 2000);
        const appendToFileMock = jest.spyOn(PersistentNodeCache.prototype as any, 'appendToFile');
        cache.set("foo", "bar");
        expect(appendToFileMock).toHaveBeenCalled();
        let item = { cmd: 'set', key: 'foo', val: 'bar'};
        expect(appendToFileMock).toBeCalledWith(`${os.homedir()}/mycache.append`, Buffer.from(JSON.stringify(item) + '\n'))
        let val = cache.get("foo");
        expect(val).toBe("bar");
        cache.close();
    });

    it('should multi set the key-value pairs', () => {
        fs.appendFileSync = jest.fn();
        let cache = new PersistentNodeCache("mycache", 1000);
        const appendToFileMock = jest.spyOn(PersistentNodeCache.prototype as any, 'appendToFile');
        cache.mset([{key: 'foo', val: 'bar'}, {key: 'alice', val: 'bob'}]);
        expect(appendToFileMock).toHaveBeenCalled();
        let item = { cmd: 'mset', keyValue: [{key: 'foo', val: 'bar'}, {key: 'alice', val: 'bob'}]};
        expect(appendToFileMock).toBeCalledWith(`${os.homedir()}/mycache.append`, Buffer.from(JSON.stringify(item) + '\n'))
        let val = cache.get("foo");
        expect(val).toBe('bar');
        val = cache.get('alice');
        expect(val).toBe('bob');
        cache.close();
    });

    it('should take a key-value pair', () => {
        fs.appendFileSync = jest.fn();
        let cache = new PersistentNodeCache("mycache", 1000);
        const appendToFileMock = jest.spyOn(PersistentNodeCache.prototype as any, 'appendToFile');
        cache.mset([{key: 'foo', val: 'bar'}, {key: 'alice', val: 'bob'}]);
        let val = cache.take('foo');
        expect(appendToFileMock).toHaveBeenCalled();
        let item = { cmd: 'del', key: 'foo'};
        expect(appendToFileMock).toBeCalledWith(`${os.homedir()}/mycache.append`, Buffer.from(JSON.stringify(item) + '\n'));
        expect(val).toBe('bar');
        val = cache.get('foo');
        expect(val).toBe(undefined);
        cache.close();
    });

    it('should delete a key-value pair', () => {
        fs.appendFileSync = jest.fn();
        let cache = new PersistentNodeCache("mycache", 1000);
        const appendToFileMock = jest.spyOn(PersistentNodeCache.prototype as any, 'appendToFile');
        cache.mset([{key: 'foo', val: 'bar'}, {key: 'alice', val: 'bob'}]);
        let val = cache.get("foo");
        expect(val).toBe('bar');
        cache.del('foo');
        let item = { cmd: 'del', key: 'foo'};
        expect(appendToFileMock).toBeCalledWith(`${os.homedir()}/mycache.append`, Buffer.from(JSON.stringify(item) + '\n'))
        val = cache.get("foo");
        expect(val).toBe(undefined);
        cache.close();
    });

    it('should expire key-value pair', async () => {
        fs.appendFileSync = jest.fn();
        let cache = new PersistentNodeCache("mycache", 1000);
        const appendToFileMock = jest.spyOn(PersistentNodeCache.prototype as any, 'appendToFile');
        cache.set("foo", "bar", 1);
        let item = { cmd: 'set', key: 'foo', val: 'bar', ttl: 1};
        expect(appendToFileMock).toBeCalledWith(`${os.homedir()}/mycache.append`, Buffer.from(JSON.stringify(item) + '\n'))
        let val = cache.get("foo");
        expect(val).toBe('bar');
        await new Promise(f => setTimeout(f, 1100));
        val = cache.get("foo");
        expect(val).toBe(undefined);
        cache.close();
    });

    it('should expire key-value pair with ttl command', async () => {
        fs.appendFileSync = jest.fn();
        let cache = new PersistentNodeCache("mycache", 1000);
        const appendToFileMock = jest.spyOn(PersistentNodeCache.prototype as any, 'appendToFile');
        cache.set("foo", "bar");
        let val = cache.get("foo");
        expect(val).toBe('bar');
        cache.ttl('foo', 1);
        let item = { cmd: 'ttl', key: 'foo', ttl: 1};
        expect(appendToFileMock).toBeCalledWith(`${os.homedir()}/mycache.append`, Buffer.from(JSON.stringify(item) + '\n'))
        await new Promise(f => setTimeout(f, 1100));
        val = cache.get("foo");
        expect(val).toBe(undefined);
        cache.close();
    });
});

describe("persistentNodeCacheBackupRestore", () => {
    beforeEach(() => {
        jest.mock('fs');
    });

    it("should save backup periodically", () => {
        fs.writeFileSync = jest.fn();
        jest.useFakeTimers();
        let cache = new PersistentNodeCache("mycache", 1000, '/tmp');
        cache.mset([{key: 'foo', val: 'bar'}, {key: 'alice', val: 'bob'}]);
        jest.advanceTimersByTime(1500);
        let data = [{key: 'foo', val: 'bar', ttl: 0}, {key: 'alice', val: 'bob', ttl: 0}]
        expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/mycache.backup', Buffer.from(JSON.stringify(data) + "\n"));
        expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/mycache.append', '');
        cache.close();
    });

    it("should restore cache from backup", async () => {
        let data = [{key: 'foo', val: 'bar', ttl: 0}, {key: 'alice', val: 'bob', ttl: 0}]
        let cmd1 = { cmd: 'set', key: 'john', val: 'doe'}
        let cmd2 = { cmd: 'del', key: 'alice'}
        let cmd3 = { cmd: 'mset', keyValue: [{key: 'abc', val: 'xyz'}, {key: 'cat', val: 'dog', ttl: 10}]}
        let appendData = JSON.stringify(cmd1) + '\n' + JSON.stringify(cmd2) + '\n' + JSON.stringify(cmd3) + '\n';
        jest.spyOn(fs, 'readFileSync');
        fs.readFileSync.mockImplementation(function (fileName: string, encoding: string) {
            if(encoding === undefined) {
                return Buffer.from(JSON.stringify(data) + '\n');
            }
            else {
                return appendData;
            }
        });
        let cache = new PersistentNodeCache("mycache", 1000);
        await cache.recover();
        let val = cache.get('foo');
        expect(val).toBe('bar');
        val = cache.get('nothing');
        expect(val).toBe(undefined);
        val = cache.get('alice');
        expect(val).toBe(undefined);
        val = cache.get('abc');
        expect(val).toBe('xyz');
        var d = new Date();
        let ttl = cache.getTtl('cat')
        expect(ttl).toBeDefined();
        expect(d.getTime() - Number(ttl)).toBeLessThanOrEqual(10);
        cache.close();
    });
});

describe('persistentNodeCacheTestWait', () => {
    beforeEach(() => {
        if(fs.existsSync(os.homedir() + '/mycache.backup')) {
            fs.unlinkSync(os.homedir() + '/mycache.backup');
        }
        if(fs.existsSync(os.homedir() + '/mycache.append')) {
            fs.unlinkSync(os.homedir() + '/mycache.append');
        }
    });

    it('should wait for the event for set', () => {
        let emitter = new EventEmitter();
        let cache = new PersistentNodeCache("mycache", 1000);
        Reflect.set(cache, 'emitter', emitter);
        Reflect.set(cache, 'flushingToDisk', true);
        cache.set('foo', 'bar');
        let val = cache.get('foo');
        expect(val).toBe(undefined);
        Reflect.set(cache, 'flushingToDisk', false);
        emitter.emit('done');
        setTimeout(() => {
            val = cache.get('foo');
            expect(val).toBe('bar');
            cache.close();
        }, 10);
    });

    it('should wait for the event for del', async () => {
        let emitter = new EventEmitter();
        let cache = new PersistentNodeCache("mycache", 1000);
        Reflect.set(cache, 'emitter', emitter);
        cache.set('foo', 'bar');
        let val = cache.get('foo')
        expect(val).toBe('bar');
        Reflect.set(cache, 'flushingToDisk', true);
        cache.del('foo');
        val = cache.get('foo')
        expect(val).toBe('bar');
        Reflect.set(cache, 'flushingToDisk', false);
        emitter.emit('done');
        setTimeout(() => {
            val = cache.get('foo');
            expect(val).toBe(undefined);
            cache.close();
        }, 10);
    });

    it('should wait for the event for set', () => {
        let emitter = new EventEmitter();
        let cache = new PersistentNodeCache("mycache", 1000);
        Reflect.set(cache, 'emitter', emitter);
        Reflect.set(cache, 'flushingToDisk', true);
        cache.mset([{key: 'foo', val: 'bar'}, {key: 'alice', val: 'bob'}]);
        let val = cache.get('alice');
        expect(val).toBe(undefined);
        val = cache.get('foo');
        expect(val).toBe(undefined);
        Reflect.set(cache, 'flushingToDisk', false);
        emitter.emit('done');
        setTimeout(() => {
            val = cache.get('foo');
            expect(val).toBe('bar');
            val = cache.get('alice')
            expect(val).toBe('bob');
            cache.close();
        }, 10);
    });

    it('should not throw ENOENT exception on restore', async () => {
        let cache = new PersistentNodeCache("mycustomcache", 30000);
        try {
            await cache.recover()
        } catch(e: any) {
            expect(e).toBeUndefined();
        }
    });
});

describe('persistentNodeCacheSerialize', () => {
    it('should set the key-value with custom serialization', () => {
        const customSerializer: CacheSerializer = {
            serialize: (item: any) => {
                return Buffer.from(Buffer.from(JSON.stringify(item)).toString('base64') + '\n');
            },
            deserialize: (bf: Buffer) => {
                return JSON.parse(Buffer.from(bf.toString().trim(), 'base64').toString());
            }
        };
        let cache = new PersistentNodeCache("custom", 2000, "", {}, customSerializer);
        const appendToFileMock = jest.spyOn(PersistentNodeCache.prototype as any, 'appendToFile');
        cache.set("foo", "bar");
        expect(appendToFileMock).toHaveBeenCalled();
        let item = { cmd: 'set', key: 'foo', val: 'bar'};
        expect(appendToFileMock).toBeCalledWith(`${os.homedir()}/custom.append`, Buffer.from(Buffer.from(JSON.stringify(item)).toString('base64') + '\n'))
        let val = cache.get("foo");
        expect(val).toBe("bar");
        cache.close();
    });

    it("should save backup periodically", () => {
        const customSerializer: CacheSerializer = {
            serialize: (item: any) => {
                return Buffer.from(Buffer.from(JSON.stringify(item)).toString('base64') + '\n');
            },
            deserialize: (bf: Buffer) => {
                return JSON.parse(Buffer.from(bf.toString().trim(), 'base64').toString());
            }
        };
        jest.useFakeTimers();
        let cache = new PersistentNodeCache("custom", 1000, '/tmp', {}, customSerializer);
        cache.mset([{key: 'foo', val: 'bar'}, {key: 'alice', val: 'bob'}]);
        jest.advanceTimersByTime(1500);
        let data = [{key: 'foo', val: 'bar', ttl: 0}, {key: 'alice', val: 'bob', ttl: 0}]
        expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/custom.backup', Buffer.from(Buffer.from(JSON.stringify(data)).toString('base64') + '\n'));
        expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/custom.append', '');
        cache.close();
    });

    it("should restore cache from backup", async () => {
        let data = [{key: 'foo', val: 'bar', ttl: 0}, {key: 'alice', val: 'bob', ttl: 0}]
        const customSerializer: CacheSerializer = {
            serialize: (item: any) => {
                return Buffer.from(Buffer.from(JSON.stringify(item)).toString('base64') + '\n');
            },
            deserialize: (bf: Buffer) => {
                return JSON.parse(Buffer.from(bf.toString().trim(), 'base64').toString());
            }
        };
        let cmd1 = { cmd: 'set', key: 'john', val: 'doe'}
        let cmd2 = { cmd: 'del', key: 'alice'}
        let cmd3 = { cmd: 'mset', keyValue: [{key: 'abc', val: 'xyz'}, {key: 'cat', val: 'dog', ttl: 10}]}
        let appendData = Buffer.from(JSON.stringify(cmd1)).toString('base64') + '\n' +
            Buffer.from(JSON.stringify(cmd2)).toString('base64') + '\n' +
            Buffer.from(JSON.stringify(cmd3)).toString('base64') + '\n';
        jest.spyOn(fs, 'readFileSync');
        fs.readFileSync.mockImplementation(function (fileName: string, encoding: string) {
            if(encoding === undefined) {
                return Buffer.from(Buffer.from(JSON.stringify(data)).toString('base64') + '\n');
            }
            else {
                return appendData;
            }
        });
        let cache = new PersistentNodeCache("custom", 1000, '', {}, customSerializer);
        await cache.recover();
        let val = cache.get('foo');
        expect(val).toBe('bar');
        val = cache.get('nothing');
        expect(val).toBe(undefined);
        val = cache.get('alice');
        expect(val).toBe(undefined);
        val = cache.get('abc');
        expect(val).toBe('xyz');
        var d = new Date();
        let ttl = cache.getTtl('cat')
        expect(ttl).toBeDefined();
        expect(d.getTime() - Number(ttl)).toBeLessThanOrEqual(10);
        cache.close();
    });
});