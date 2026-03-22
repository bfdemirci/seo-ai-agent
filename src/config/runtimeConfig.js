import 'dotenv/config';

export function getRuntimeConfig() {
  return {
    schedulerEnabled:     process.env.ENABLE_SCHEDULER      !== 'false',
    schedulerIntervalMs:  parseInt(process.env.SCHEDULER_INTERVAL_MS || '3600000', 10) || 3600000,
    gscSyncEnabled:       process.env.GSC_SYNC_ENABLED      !== 'false',
    publishEnabled:       process.env.PUBLISH_ENABLED       !== 'false',
    campaignSafeMode:     process.env.CAMPAIGN_SAFE_MODE    !== 'false',
    maxCampaignsPerCycle: parseInt(process.env.MAX_CAMPAIGNS_PER_CYCLE || '3', 10) || 3,
    dashboardEnabled:     process.env.DASHBOARD_ENABLED     !== 'false',
  };
}
