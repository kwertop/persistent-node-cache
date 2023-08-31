"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cache_1 = require("./cache");
cache_1.LocalCache.InitiateInstance();
cache_1.LocalCache.set("foo", "bar");
cache_1.LocalCache.set("cat", "dog");
cache_1.LocalCache.set("something", "nothing");
// LocalCache.recover();
// let val = LocalCache.get("foo")
// console.log(val);
