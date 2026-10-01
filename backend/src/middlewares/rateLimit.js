/**
 * middlewares/rateLimit.js - Limiteur de debit en memoire (fenetre glissante)
 * ----------------------------------------------------------------------------
 * Limite le nombre de requetes par cle (IP par defaut) sur une fenetre de temps.
 *
 * Limite connue : en serverless (Vercel) chaque instance a sa propre memoire,
 * le plafond est donc "par instance". C'est suffisant contre les abus simples
 * (force brute sur /login, spam du chatbot). Pour un plafond global, brancher
 * un store partage (Upstash Redis, Vercel KV...).
 */
function rateLimit({
  windowMs = 60_000,
  max = 60,
  keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || "anon",
  message = "Trop de requetes, reessayez dans quelques instants.",
} = {}) {
  const hits = new Map(); // cle -> [timestamps]

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message, retryAfter });
    }

    recent.push(now);
    hits.set(key, recent);

    // Nettoyage paresseux pour eviter une croissance infinie de la Map
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      }
    }

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - recent.length)));
    next();
  };
}

module.exports = { rateLimit };
