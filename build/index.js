"use strict";
// import { LocalCache } from "./cache";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistentNodeCache = void 0;
// import { PersistentNodeCache } from "./persistentNodeCache";
// LocalCache.InitiateInstance();
// LocalCache.set("foo", "bar");
// LocalCache.set("cat", "dog");
// LocalCache.set("something", "nothing");
// LocalCache.recover();
// let val = LocalCache.get("foo")
// console.log(val);
var persistentNodeCache_1 = require("./persistentNodeCache");
Object.defineProperty(exports, "PersistentNodeCache", { enumerable: true, get: function () { return __importDefault(persistentNodeCache_1).default; } });
