import 'dotenv/config';
import { validateEnv } from './config/envValidator.js';
import app from './app.js';
import { startScheduler } from './services/scheduler/schedulerService.js';

var PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  validateEnv();
}

var server = app.listen(PORT, function() {
  console.log('[SERVER] running on port ' + PORT + ' [' + (process.env.NODE_ENV || 'development') + ']');
  if (process.env.ENABLE_SCHEDULER === 'true') {
    try {
      startScheduler();
      console.log('[SCHEDULER] started');
    } catch (err) {
      console.error('[SCHEDULER] failed to start:', err && err.message);
    }
  }
});

server.timeout = 180000;
export default server;


import { stopScheduler } from './services/scheduler/schedulerService.js';
function _shutdown(sig) {
  console.log('[SERVER] ' + sig + ' received — shutting down');
  try { stopScheduler(); } catch (_) {}
  console.log('[SERVER] shutdown complete');
  process.exit(0);
}
process.on('SIGTERM', function(){ _shutdown('SIGTERM'); });
process.on('SIGINT',  function(){ _shutdown('SIGINT'); });
