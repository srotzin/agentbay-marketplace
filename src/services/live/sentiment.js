/**
 * Sentiment Analysis — Analyze text sentiment using keyword scoring
 * Fast, free, no API needed. Runs locally.
 */

const POSITIVE = new Set([
  "good", "great", "excellent", "amazing", "wonderful", "fantastic", "love",
  "best", "happy", "joy", "beautiful", "perfect", "brilliant", "outstanding",
  "superb", "impressive", "delightful", "pleased", "glad", "exciting",
  "awesome", "nice", "positive", "success", "win", "recommend", "enjoy",
  "helpful", "innovative", "efficient", "powerful", "remarkable", "superior",
  "thrilled", "grateful", "optimistic", "confident", "strong", "growth",
  "profit", "gain", "improve", "upgrade", "achieve", "celebrate",
]);

const NEGATIVE = new Set([
  "bad", "terrible", "awful", "horrible", "worst", "hate", "ugly",
  "poor", "sad", "angry", "disappointed", "fail", "failure", "wrong",
  "broken", "useless", "waste", "boring", "weak", "slow", "expensive",
  "problem", "issue", "bug", "error", "crash", "frustrating", "annoying",
  "painful", "loss", "decline", "drop", "risk", "threat", "concern",
  "worry", "fear", "doubt", "negative", "difficult", "complex", "confusing",
  "dangerous", "toxic", "scam", "fraud", "misleading", "overpriced",
]);

export function analyzeSentiment(text) {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  const total = words.length;

  let posCount = 0;
  let negCount = 0;
  const posWords = [];
  const negWords = [];

  for (const word of words) {
    if (POSITIVE.has(word)) { posCount++; posWords.push(word); }
    if (NEGATIVE.has(word)) { negCount++; negWords.push(word); }
  }

  const posScore = posCount / Math.max(total, 1);
  const negScore = negCount / Math.max(total, 1);
  const compound = (posScore - negScore);

  let label;
  if (compound > 0.05) label = "positive";
  else if (compound < -0.05) label = "negative";
  else label = "neutral";

  return {
    label,
    scores: {
      positive: Math.round(posScore * 1000) / 1000,
      negative: Math.round(negScore * 1000) / 1000,
      neutral: Math.round((1 - posScore - negScore) * 1000) / 1000,
      compound: Math.round(compound * 1000) / 1000,
    },
    details: {
      word_count: total,
      positive_words: [...new Set(posWords)].slice(0, 10),
      negative_words: [...new Set(negWords)].slice(0, 10),
    },
    provider: "HiveAgent Sentiment",
  };
}
