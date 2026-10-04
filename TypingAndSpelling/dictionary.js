const directDefinitionCache = new Map();
const LOOKUP_TIMEOUT_MS = 8000;
const LOOKUP_TIMEOUT_ATTEMPTS = 2;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(url, timeoutMs = LOOKUP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractFreeDictionaryApiDefinitionText(apiData) {
  if (!Array.isArray(apiData.entries) || apiData.entries.length === 0) return null;

  const definitions = [];

  for (const entry of apiData.entries) {
    if (typeof entry.partOfSpeech !== "string") continue;
    definitions.push(entry.partOfSpeech);

    if (!Array.isArray(entry.senses)) continue;
    let i = 0;
    for (const sense of entry.senses) {
      if (typeof sense.definition !== "string") continue;
      i += 1;

      const formatted = `    ${i}. ${sense.definition}`;
      definitions.push(formatted);

      if (!Array.isArray(sense.subsenses)) continue;
      let j = 0;
      for (const subsense of sense.subsenses) {
        if (typeof subsense.definition !== "string") continue;
        j += 1;

        const formatted = `        ${i}.${j} ${subsense.definition}`;
        definitions.push(formatted);
      }
    }
  }

  if (definitions.length === 0) return null;

  return definitions.join("\n");
}

function extractDatamuseDefinitionText(apiData, requestedWord) {
  if (!Array.isArray(apiData) || apiData.length === 0) return null;

  const firstEntry = apiData[0];
  if (!firstEntry || typeof firstEntry.word !== "string") return null;

  const firstWord = firstEntry.word.toLowerCase();
  const targetWord = requestedWord.toLowerCase();
  if (firstWord !== targetWord) return null;

  const definitions = [];

  if (!Array.isArray(firstEntry.defs) || firstEntry.defs.length === 0) return null;

  for (const rawDef of firstEntry.defs) {
    if (typeof rawDef !== "string") continue;

    const parts = rawDef.split("\t");
    const partOfSpeech = parts.length > 1 ? parts[0].trim() : "";
    const definitionBody = (parts.length > 1 ? parts[1] : parts[0]).trim();
    if (!definitionBody) continue;

    const formatted = partOfSpeech ? `(${partOfSpeech}) ${definitionBody}` : definitionBody;
    definitions.push(formatted);
  }

  if (definitions.length === 0) return null;

  const uniqueDefinitions = [...new Set(definitions)];
  return uniqueDefinitions.map((definition, index) => `${index + 1}. ${definition}`).join("\n");
}

function extractRelatedWords(definitionText) {
  const relatedWords = new Set();
  const patterns = [
    /^simple past of\s+(.+)$/i,
    /^simple past and past participle of\s+(.+)$/i,
    /^present participle and gerund of\s+(.+)$/i,
    /^third-person singular simple present indicative of\s+(.+)$/i,
    /^superlative form of\s+([^:]+?)(?::|$)/i,
    /^past participle of\s+(.+)$/i,
    /^plural of\s+(.+)$/i,
    /^clipping of\s+(.+)$/i,
    /^attributive form of\s+(.+?)[.]?$/i,
  ];

  for (const line of definitionText.split("\n")) {
    const meaning = line
      .replace(/^\s*\d+\.\s*/, "")
      .trim();
    if (!meaning || meaning.startsWith("(")) continue;

    for (const pattern of patterns) {
      const match = meaning.match(pattern);
      if (match) {
        const relatedWord = match[1].trim().replace(/[.,;]+$/, "").trim().toLowerCase();
        if (relatedWord) relatedWords.add(relatedWord);
        break;
      }
    }
  }

  return relatedWords;
}

async function fetchDefinitionFromFreeDictionaryApi(word) {
  const url = `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}`;
  const response = await fetchJsonWithTimeout(url);

  if (!response.ok) {
    throw new Error(`FreeDictionaryAPI HTTP ${response.status}`);
  }

  const data = await response.json();
  const definition = extractFreeDictionaryApiDefinitionText(data);
  if (!definition) {
    throw new Error("Free Dictionary API had no definition for this word");
  }

  return definition;
}

async function fetchDefinitionFromDatamuse(word) {
  const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=5`;
  const response = await fetchJsonWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Datamuse HTTP ${response.status}`);
  }

  const data = await response.json();
  const definition = extractDatamuseDefinitionText(data, word);
  if (!definition) {
    throw new Error("Datamuse had no definition for this word");
  }

  return definition;
}

async function lookupDirectDefinition(word) {
  const cacheKey = word.toLowerCase();
  if (directDefinitionCache.has(cacheKey)) {
    return directDefinitionCache.get(cacheKey);
  }

  const sources = [
    { name: "FreeDictionaryAPI", lookup: fetchDefinitionFromFreeDictionaryApi },
    { name: "Datamuse", lookup: fetchDefinitionFromDatamuse },
  ];
  const failures = [];

  for (const source of sources) {
    for (let attempt = 1; attempt <= LOOKUP_TIMEOUT_ATTEMPTS; attempt += 1) {
      try {
        const definition = await source.lookup(word);
        const result = { source: source.name, definition };
        directDefinitionCache.set(cacheKey, result);
        return result;
      } catch (error) {
        const isTimeout = error?.name === "AbortError";
        const reason = isTimeout ? "request timed out" : (error?.message || "unknown error");
        failures.push(`${source.name}: ${reason}`);

        if (!isTimeout) break;
        if (attempt < LOOKUP_TIMEOUT_ATTEMPTS) {
          await delay(750 * attempt);
        }
      }
    }
  }

  throw new Error(`Definition lookup failed. ${failures.join(" | ")}`);
}

async function lookupDefinition(word, visitedWords = new Set()) {
  const cacheKey = word.toLowerCase();
  if (visitedWords.has(cacheKey)) return null;

  const nextVisitedWords = new Set(visitedWords);
  nextVisitedWords.add(cacheKey);

  const directResult = await lookupDirectDefinition(word);
  let completeDefinition = directResult.definition;

  for (const relatedWord of extractRelatedWords(directResult.definition)) {
    try {
      const relatedResult = await lookupDefinition(relatedWord, nextVisitedWords);
      if (relatedResult) {
        completeDefinition += `\n\nDefinition of ${relatedWord}:\n${relatedResult.definition}`;
      }
    } catch (error) {
      console.warn("Related definition lookup failed", {
        word,
        relatedWord,
        error,
      });
    }
  }

  return { source: directResult.source, definition: completeDefinition };
}

export { lookupDefinition };
