export function withTimeout(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timeout after ${ms}ms`)), ms)
    )
  ]);
}
