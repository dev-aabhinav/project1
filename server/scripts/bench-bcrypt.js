// Measures bcrypt hash time per cost factor, and login-hash throughput under concurrency.
// Run: node scripts/bench-bcrypt.js
// Timing = wall clock around one bcrypt.hash() call (includes thread-pool hand-off, excludes HTTP/DB).

const bcrypt = require("bcrypt");
const os = require("os");

const PASSWORD = "correct horse battery staple";
const SAMPLES = 20;   // timed hashes per cost factor
const WARMUP = 2;     // untimed hashes first (JIT, thread pool start-up)

function percentile(sortedMs, p) {
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[idx];
}

async function timeOne(rounds) {
  const start = process.hrtime.bigint();
  await bcrypt.hash(PASSWORD, rounds);
  return Number(process.hrtime.bigint() - start) / 1e6; // ns -> ms
}

async function sequential(rounds) {
  for (let i = 0; i < WARMUP; i++) await timeOne(rounds);
  const ms = [];
  for (let i = 0; i < SAMPLES; i++) ms.push(await timeOne(rounds));
  ms.sort((a, b) => a - b);
  return { median: percentile(ms, 50), p95: percentile(ms, 95), max: ms[ms.length - 1] };
}

async function concurrent(rounds, n) {
  const start = process.hrtime.bigint();
  await Promise.all(Array.from({ length: n }, () => bcrypt.hash(PASSWORD, rounds)));
  const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
  return { totalMs, perSec: (n / totalMs) * 1000 };
}

(async () => {
  console.log(`node ${process.version}, ${os.cpus().length} CPUs (${os.cpus()[0].model}), ` +
    `UV_THREADPOOL_SIZE=${process.env.UV_THREADPOOL_SIZE || "4 (default)"}`);
  console.log(`\nSequential: ${SAMPLES} timed hashes per cost (after ${WARMUP} warm-up)`);
  console.log("rounds | median ms | p95 ms | max ms");
  for (const rounds of [10, 11, 12, 13]) {
    const r = await sequential(rounds);
    console.log(`  ${rounds}   | ${r.median.toFixed(1).padStart(9)} | ${r.p95.toFixed(1).padStart(6)} | ${r.max.toFixed(1).padStart(6)}`);
  }

  console.log("\nConcurrent: N hashes started at once (simulates N simultaneous logins)");
  console.log("rounds | N  | total ms | hashes/sec");
  for (const rounds of [10, 12]) {
    for (const n of [1, 4, 8, 16]) {
      const r = await concurrent(rounds, n);
      console.log(`  ${rounds}   | ${String(n).padStart(2)} | ${r.totalMs.toFixed(0).padStart(8)} | ${r.perSec.toFixed(1).padStart(10)}`);
    }
  }
})();
