persistent-node-cache ![Tests](https://github.com/kwertop/persistent-node-cache/actions/workflows/node.js.yml/badge.svg)
==========

Light weight persistent cache backed by [node-cache](https://github.com/node-cache/node-cache).
It persists in-memory cache periodically on disk while also saving every write command in an append-only manner
to guarantee minimal data loss during application restarts.

# Quick Start

## Install

```shell
npm i persistent-node-cache
```

## Usage

### Initialize Cache

```typescript
import { PersistentNodeCache } from "persistent-node-cache";

const cache = new PersistentNodeCache("mycache", 1000);
```

#### Options

 - `cacheName`: `string` *(required)* the name of the cache. Used for recovering/restoring cache from disk.
 - `period`: `number` *(default: `1 second`)* interval at which cache backup is saved
 - `dir`: `string` *(default: `home dir of user`)* directory where backup files will be created
 - `opts`: `object` standard options of `node-cache` package
 - `serializer`: [CacheSerializer](#cacheserializer-type) *(default: `JSON serializer`)* custom serializer for persisting data on disk

#### CacheSerializer Type

```typescript
type CacheSerializer = {
    serialize: Function;
    deserialize: Function;
}
```

### Cache Operations

All cache operations are similar to those of **node-cache** package since it's an extension of implementation of **node-cache**.
Please refer to **node-cache** docs for an extensive list of all operations supported.

#### Store a key (SET):

`cache.set(key, val, [ttl])`

Sets a key-value pair. Defining `ttl` is optional.

```typescript
cache.set("mykey", "myval", 1000);    //true
```

#### Retrieve a key (GET):

Get a key-value pair.

```typescript
cache.get("mykey");    //myval
```

#### Delete a key (DEL):

Delete a key from cache. Returns the number of entries deleted.

```typescript
cache.del("mykey");    //1
```

### Restore/Recover Cache

The `cacheName` field should be passed to tell which cache to restore. If `dir` field was passed during cache initialization
previously, it should be passed during recovery as well to locate the backup files.

```typescript
const cache = new PersistentNodeCache("mycache");
cache.recover();

cache.get("mykey");    //myval
```

### Use Custom Serializer

```typescript
import { PersistentNodeCache, CacheSerializer } from "persistent-node-cache";

const customSerializer: CacheSerializer = {
    serialize: (item: any) => {
        return Buffer.from(Buffer.from(JSON.stringify(item)).toString('base64') + '\n');
    },
    deserialize: (bf: Buffer) => {
        return JSON.parse(Buffer.from(bf.toString().trim(), 'base64').toString());
    }
};

const cache = new PersistentNodeCache("mycache", 0, '', {}, customSerializer);
```

### Benchmarks

Benchmark figures for get/set operations (on an Apple M2, 8 GB RAM system)

|                          | get                 | set                  |
|--------------------------|---------------------|----------------------|
| `persistent-node-cache`  | 21,074,363 ops/sec  | 623,668 ops/sec      |
| `node-cache`             | 15,939,686 ops/sec  | 8,862,257 ops/sec    |
| `persistent-cache`       | 8,670,967 ops/sec   | 550 ops/sec          |