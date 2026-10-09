// "What's new" (polish): after an update, a returning player sees once what changed, so new
// things are found instead of missed. Bump `version` and rewrite `items` (i18n keys) each time.

export const NEWS = {
  version: 28,
  items: ['news.kitchen', 'news.cooks', 'news.dishes', 'news.guide', 'news.backKitchen'] as const,
};
