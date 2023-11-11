# persistent-node-cache ![Tests](https://github.com/kwertop/persistent-node-cache/actions/workflows/run_tests.yml/badge.svg)

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

const persistentCache = new PersistentNodeCache("mycache", 1000);
```

#### Options

 - `cacheName`: *(required)* the name of the cache. Used for recovering/restoring cache from disk.
 - `period`: *(default: `1 second`)* interval at which cache backup is saved
 - `dir`: *(default: `home dir of user`)* directory where backup files will be created
 - `opts`: standard options of `node-cache` package


### Cache Operations

All cache operations are similar to those of **node-cache** package since it's an extension of implementation of **node-cache**.
Please refer to **node-cache** docs for an extensive list of all operations supported.

#### Store a key (SET):

`persistentCache.set(key, val, [ttl])`

Sets a key-value pair. Defining `ttl` is optional.

```typescript
persistentCache.set("mykey", "myval", 1000);    //true
```

#### Retrieve a key (GET):

Get a key-value pair.

```typescript
persistentCache.get("mykey");    //myval
```

#### Delete a key (DEL):

Delete a key from cache. Returns the number of entries deleted.

```typescript
persistentCache.del("mykey");    //1
```

### Restore/Recover Cache

The `cacheName` field should be passed to tell which cache to restore. If `dir` field was passed during cache initialization
previously, it should be passed during recovery as well to locate the backup files.

```typescript
const persistentCache = new PersistentNodeCache("mycache");
persistentCache.recover();

persistentCache.get("mykey");    //myval
```