export async function withRetry(fn, { retries = 2, delayMs = 1000, name = "fn" } = {}) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[RETRY] ${name} attempt ${i + 1} failed: ${err.message}`);
      if (i < retries) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
