export const ADSENSE_CLIENT = 'ca-pub-7443237558968985';
export const AD_MODES = Object.freeze(['off', 'consent', 'live']);

const clientPattern = /^ca-pub-\d{16}$/;
const slotPattern = /^\d+$/;

/** Normalize the public build configuration before any advertising HTML is rendered. */
export function createAdPolicy(config = {}) {
  const policy = {
    mode: config.mode ?? 'off',
    client: config.client ?? ADSENSE_CLIENT,
    articleSlotId: config.articleSlotId == null ? '' : String(config.articleSlotId).trim(),
    siteReady: config.siteReady === true,
    cmpPublished: config.cmpPublished === true,
    cmpVerified: config.cmpVerified === true,
    autoAdsDisabled: config.autoAdsDisabled === true,
  };
  if (!AD_MODES.includes(policy.mode)) throw new Error(`Unknown AdSense mode: ${policy.mode}`);
  if (!clientPattern.test(policy.client)) throw new Error('AdSense client must be a valid ca-pub identifier');
  if (policy.articleSlotId && !slotPattern.test(policy.articleSlotId)) {
    throw new Error('AdSense articleSlotId must contain only digits');
  }
  if (policy.mode === 'live') {
    const missing = ['siteReady', 'cmpPublished', 'cmpVerified', 'autoAdsDisabled']
      .filter(key => !policy[key]);
    if (!policy.articleSlotId) missing.push('articleSlotId');
    if (missing.length) throw new Error(`Live AdSense requires: ${missing.join(', ')}`);
  }
  return Object.freeze(policy);
}

export function adPolicyFromEnv(env = process.env) {
  return createAdPolicy({
    mode: env.ADSENSE_MODE || 'off',
    client: env.ADSENSE_CLIENT || ADSENSE_CLIENT,
    articleSlotId: env.ADSENSE_ARTICLE_SLOT_ID || '',
    siteReady: env.ADSENSE_SITE_READY === 'true',
    cmpPublished: env.ADSENSE_CMP_PUBLISHED === 'true',
    cmpVerified: env.ADSENSE_CMP_VERIFIED === 'true',
    autoAdsDisabled: env.ADSENSE_AUTO_ADS_DISABLED === 'true',
  });
}
