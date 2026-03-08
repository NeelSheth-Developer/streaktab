/**
 * StreakTab - Motivation System
 * Uses type.fit API (https://type.fit/api/quotes) for inspirational quotes.
 * Falls back to 15 static quotes if API fails.
 */

(function () {
  const FALLBACK_QUOTES = [
    { content: 'The body achieves what the mind believes.', author: 'Napoleon Hill' },
    { content: 'Take care of your body. It\'s the only place you have to live.', author: 'Jim Rohn' },
    { content: 'Physical fitness is not only one of the most important keys to a healthy body, it is the basis of dynamic and creative intellectual activity.', author: 'John F. Kennedy' },
    { content: 'Strength doesn\'t come from what you can do. It comes from overcoming the things you thought you couldn\'t.', author: 'Rikki Rogers' },
    { content: 'A year from now you may wish you had started today.', author: 'Karen Lamb' },
    { content: 'The last three or four reps is what makes the muscle grow. This area of pain divides the champion from someone else.', author: 'Arnold Schwarzenegger' },
    { content: 'Fitness is not about being better than someone else. It\'s about being better than you used to be.', author: 'Khloe Kardashian' },
    { content: 'The only way to define your limits is by going beyond them.', author: 'Arthur C. Clarke' },
    { content: 'Exercise is king. Nutrition is queen. Put them together and you\'ve got a kingdom.', author: 'Jack LaLanne' },
    { content: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
    { content: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
    { content: 'The harder you work, the luckier you get.', author: 'Gary Player' },
    { content: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
    { content: 'Whether you think you can or you think you can\'t, you\'re right.', author: 'Henry Ford' },
    { content: 'I don\'t count my sit-ups. I only start counting when it starts hurting.', author: 'Muhammad Ali' }
  ];

  async function fetchQuote() {
    try {
      const quote = await chrome.runtime.sendMessage({ type: 'GET_QUOTE' });
      if (quote && quote.content) return quote;
    } catch (_) {}
    const idx = Math.floor(Math.random() * FALLBACK_QUOTES.length);
    return FALLBACK_QUOTES[idx];
  }

  function showQuote(quote) {
    const quoteEl = document.getElementById('quoteText');
    const authorEl = document.getElementById('quoteAuthor');
    if (quoteEl) quoteEl.textContent = `"${quote.content}"`;
    if (authorEl) authorEl.textContent = quote.author ? `— ${quote.author}` : '';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const quote = await fetchQuote();
    showQuote(quote);
  });
})();
