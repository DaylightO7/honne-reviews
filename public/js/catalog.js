/**
 * HonneReviews - Catalog & Product List Module
 */

function formatProductPrice(price) {
  if (price === undefined || price === null || isNaN(Number(price))) {
    return '0';
  }
  return Number(price).toLocaleString('en-IN');
}

function truncateSnippet(text, maxLen = 140) {
  if (!text) return 'No reviews submitted yet.';
  const clean = String(text).trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen).trim() + '...';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatProductPrice, truncateSnippet };
}
