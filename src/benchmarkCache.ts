const Benchmarkify = require("benchmarkify");
import PersistentNodeCache from "./persistentNodeCache";
import NodeCache from "node-cache";

const nodeCache = new NodeCache();
const persistentCache = new PersistentNodeCache("mycache", 1000);
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