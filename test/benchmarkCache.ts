import * as Benchmark from 'benchmark';

var suite = new Benchmark.Suite();

suite.add('cache-benchmark', {
    defer: true,
    fn: async function(deferred) {
      deferred.resolve();
    }
}).on('complete', function () {
    console.log(this[0].stats)
}).run({ async: true });