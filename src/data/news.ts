// "What's new" (polish): after an update, a returning player sees once what changed, so new
// things are found instead of missed. Bump `version` and rewrite `items` (i18n keys) each time.

export const NEWS = {
  version: 36,
  items: ['news.jam', 'news.events', 'news.closed', 'news.coins', 'news.care', 'news.restroom', 'news.heroes', 'news.offers', 'news.reminders', 'news.signs', 'news.dining'] as const,
};
