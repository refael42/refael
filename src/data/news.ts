// "What's new" (polish): after an update, a returning player sees once what changed, so new
// things are found instead of missed. Bump `version` and rewrite `items` (i18n keys) each time.

export const NEWS = {
  version: 22,
  items: ['news.delivery', 'news.park', 'news.crown', 'news.weekend', 'news.anim', 'news.kids', 'news.festival'] as const,
};
