"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Benchmarkify = require("benchmarkify");
const persistentNodeCache_1 = __importDefault(require("./persistentNodeCache"));
const node_cache_1 = __importDefault(require("node-cache"));
const nodeCache = new node_cache_1.default();
const persistentCache = new persistentNodeCache_1.default("mycache", 1000);
const benchmark = new Benchmarkify("persistent-node-cache", { description: "benchmark to test write commands", chartImage: true }).printHeader();
benchmark.createSuite("cache-benchmark-test-set", {
    time: 1000, description: "benchmark single set command"
}).add("test persistent-cache set", () => {
    persistentCache.set("foo", "bar");
}).ref("test node-cache set", () => {
    nodeCache.set("alice", "bob");
});
benchmark.createSuite("cache-benchmark-test-get", {
    time: 1000, description: "benchmark single get command"
}).setup(() => {
    persistentCache.set("foo", "bar");
    nodeCache.set("alice", "bob");
}).add("test persistent-cache get", () => {
    persistentCache.get("foo");
}).ref("test node-cache get", () => {
    nodeCache.get("alice");
});
benchmark.run();
