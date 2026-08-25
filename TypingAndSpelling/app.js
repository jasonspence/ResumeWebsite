const wordInput = document.getElementById("wordInput");
const restartButton = document.getElementById("restartButton");
const trashPreviousButton = document.getElementById("trashPreviousButton");
const definePreviousButton = document.getElementById("definePreviousButton");
const downloadListsButton = document.getElementById("downloadListsButton");
const scoreDisplay = document.getElementById("scoreDisplay");
const efficiencyDisplay = document.getElementById("efficiencyDisplay");
const feedback = document.getElementById("feedback");
const promptWordEl = document.getElementById("promptWord");
const previousWordEl = document.getElementById("previousWord");
const definitionDisplay = document.getElementById("definitionDisplay");

let currentWord = "";
let words = [];
let wordsPassed = 0;
let streak = 0;
let topStreak = 0;
let lettersTyped = 0;
let lettersRemoved = 0;
let previousInputValue = "";
let pendingInsertedChars = 0;
let pendingRemovedChars = 0;
let previousWord = "";
let rejectedWords = [];
const definitionCache = new Map();
const LOOKUP_TIMEOUT_MS = 8000;
const LOOKUP_ROUNDS = 2;

function pickRandomWord(wordList) {
  const index = Math.floor(Math.random() * wordList.length);
  return wordList[index];
}

function parseWordList(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function getInsertedCharCount(event) {
  if (!event.inputType?.startsWith("insert")) return 0;
  if (typeof event.data === "string") return event.data.length;
  return 0;
}

function updateScore() {
  const netLetters = lettersTyped - lettersRemoved;
  const efficiencyPercent = lettersTyped === 0 ? 0 : (netLetters / lettersTyped) * 100;

  scoreDisplay.textContent = `Words passed: ${wordsPassed} | Streak: ${streak} | Letters typed: ${netLetters} | Mistakes: ${lettersRemoved}`;
  efficiencyDisplay.textContent = `Efficiency: ${netLetters}/${lettersTyped} (${efficiencyPercent.toFixed(1)}%) | Top streak: ${topStreak}`;
}

function updatePreviousWordDisplay() {
  previousWordEl.textContent = previousWord;
  trashPreviousButton.disabled = !previousWord;
  definePreviousButton.disabled = !previousWord;
}

function setDefinitionMessage(message, kind = "") {
  definitionDisplay.textContent = message;
  definitionDisplay.className = kind ? `definition ${kind}` : "definition";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(value) {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return asNumber;
  return null;
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

function extractDefinitionText(apiData) {
  if (!Array.isArray(apiData) || apiData.length === 0) return null;

  const firstEntry = apiData[0];
  if (!Array.isArray(firstEntry.meanings) || firstEntry.meanings.length === 0) return null;

  const firstMeaning = firstEntry.meanings[0];
  if (!Array.isArray(firstMeaning.definitions) || firstMeaning.definitions.length === 0) return null;

  const firstDefinition = firstMeaning.definitions[0];
  if (!firstDefinition?.definition) return null;

  const partOfSpeech = firstMeaning.partOfSpeech ? ` (${firstMeaning.partOfSpeech})` : "";
  return `${firstDefinition.definition}${partOfSpeech}`;
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

async function fetchDefinitionFromDictionaryApi(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const response = await fetchJsonWithTimeout(url);

  if (!response.ok) {
    const retryAfter = parseRetryAfterSeconds(response.headers.get("retry-after"));
    const retryHint = retryAfter !== null ? ` (retry-after ${retryAfter}s)` : "";
    throw new Error(`DictionaryAPI HTTP ${response.status}${retryHint}`);
  }

  const data = await response.json();
  const definition = extractDefinitionText(data);
  if (!definition) {
    throw new Error("DictionaryAPI response format was unexpected");
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

async function lookupDefinition(word) {
  const cacheKey = word.toLowerCase();
  if (definitionCache.has(cacheKey)) {
    return definitionCache.get(cacheKey);
  }

  const sources = [
    { name: "Datamuse", lookup: fetchDefinitionFromDatamuse },
    { name: "DictionaryAPI", lookup: fetchDefinitionFromDictionaryApi },
  ];
  const failures = [];

  for (let round = 1; round <= LOOKUP_ROUNDS; round += 1) {
    for (const source of sources) {
      try {
        const definition = await source.lookup(word);
        const result = { source: source.name, definition };
        definitionCache.set(cacheKey, result);
        return result;
      } catch (error) {
        const reason = error?.name === "AbortError" ? "request timed out" : (error?.message || "unknown error");
        failures.push(`${source.name}: ${reason}`);
      }
    }

    if (round < LOOKUP_ROUNDS) {
      await delay(750 * round);
    }
  }

  throw new Error(`Definition lookup failed. ${failures.join(" | ")}`);
}

async function definePreviousWord() {
  if (!previousWord) return;

  definePreviousButton.disabled = true;
  setDefinitionMessage("Looking up definition...", "loading");

  try {
    const result = await lookupDefinition(previousWord);
    if (result.source === "DictionaryAPI") {
      setDefinitionMessage(`Backup dictionary: ${previousWord}: ${result.definition}`, "success");
    } else {
      setDefinitionMessage(`${previousWord}:\n${result.definition}`, "success");
    }
  } catch (error) {
    console.error("Definition lookup failed", { word: previousWord, error });
    setDefinitionMessage(error.message || "Could not load definition.", "error");
  } finally {
    definePreviousButton.disabled = !previousWord;
  }
}

function removeWordFromActiveList(wordToRemove) {
  words = words.filter((word) => word !== wordToRemove);
}

function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadUpdatedLists() {
  const sortedRejected = [...rejectedWords].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const wordsContent = words.length > 0 ? `${words.join("\n")}\n` : "";
  const rejectedContent = sortedRejected.length > 0 ? `${sortedRejected.join("\n")}\n` : "";

  downloadTextFile("words.txt", wordsContent);
  downloadTextFile("rejected_words.txt", rejectedContent);
}

async function loadWord() {
  try {
    const response = await fetch("words.txt");
    if (!response.ok) throw new Error("Could not load words file.");
    const raw = await response.text();
    words = parseWordList(raw);

    if (words.length === 0) throw new Error("Words file is empty.");

    setNextWord();
  } catch (error) {
    promptWordEl.textContent = "Unavailable";
    feedback.textContent = error.message;
    feedback.className = "status error";
  }
}

async function loadRejectedWords() {
  try {
    const response = await fetch("rejected_words.txt");
    if (!response.ok) {
      rejectedWords = [];
      return;
    }

    const raw = await response.text();
    rejectedWords = parseWordList(raw);
  } catch {
    rejectedWords = [];
  }
}

function setNextWord() {
  if (currentWord) {
    previousWord = currentWord;
    updatePreviousWordDisplay();
  }

  if (words.length === 0) {
    currentWord = "";
    promptWordEl.textContent = "";
    return;
  }

  currentWord = pickRandomWord(words);
  promptWordEl.textContent = currentWord;
  wordInput.value = "";
  previousInputValue = "";
  pendingInsertedChars = 0;
  pendingRemovedChars = 0;
}

function restartSession() {
  wordsPassed = 0;
  streak = 0;
  topStreak = 0;
  lettersTyped = 0;
  lettersRemoved = 0;
  previousInputValue = "";
  pendingInsertedChars = 0;
  pendingRemovedChars = 0;
  previousWord = "";
  feedback.textContent = "";
  feedback.className = "";
  setDefinitionMessage("");
  updatePreviousWordDisplay();
  updateScore();

  if (words.length > 0) {
    currentWord = "";
    setNextWord();
  }
}

function trashPreviousWord() {
  if (!previousWord) return;

  const trashedWord = previousWord;
  rejectedWords.push(trashedWord);
  removeWordFromActiveList(trashedWord);
  previousWord = "";
  updatePreviousWordDisplay();
  setDefinitionMessage("");
  feedback.textContent = `${trashedWord} moved to trash list.`;
  feedback.className = "status success";

  if (currentWord === trashedWord) {
    if (words.length > 0) {
      currentWord = "";
      setNextWord();
    } else {
      currentWord = "";
      promptWordEl.textContent = "";
      wordInput.value = "";
      feedback.textContent = "No words left in active list.";
      feedback.className = "status error";
    }
  }
}

wordInput.addEventListener("beforeinput", (event) => {
  const start = wordInput.selectionStart ?? 0;
  const end = wordInput.selectionEnd ?? 0;
  const selectionLength = Math.max(end - start, 0);

  pendingInsertedChars = getInsertedCharCount(event);
  pendingRemovedChars = 0;

  if (selectionLength > 0) {
    if (event.inputType?.startsWith("insert") || event.inputType?.startsWith("delete")) {
      pendingRemovedChars = selectionLength;
    }
  } else if (event.inputType === "deleteContentBackward" || event.inputType === "deleteContentForward") {
    pendingRemovedChars = 1;
  }
});

wordInput.addEventListener("input", () => {
  if (!currentWord) return;

  const currentValue = wordInput.value;
  const isWordMatched = currentValue === currentWord;
  const lengthDelta = currentValue.length - previousInputValue.length;
  let insertedChars = pendingInsertedChars;
  let removedChars = pendingRemovedChars;

  if (insertedChars === 0 && lengthDelta > 0) {
    insertedChars = lengthDelta;
  }

  const inferredRemoved = insertedChars - lengthDelta;
  if (inferredRemoved > removedChars) {
    removedChars = inferredRemoved;
  }

  if (removedChars < 0) {
    removedChars = 0;
  }

  let shouldRefreshScore = false;

  if (insertedChars > 0) {
    lettersTyped += insertedChars;
    shouldRefreshScore = true;
  }

  if (removedChars > 0) {
    lettersRemoved += removedChars;
    streak = 0;
    shouldRefreshScore = true;
  }

  previousInputValue = currentValue;
  pendingInsertedChars = 0;
  pendingRemovedChars = 0;

  if (isWordMatched) {
    wordsPassed += 1;
    streak += 1;
    if (streak > topStreak) {
      topStreak = streak;
    }
    shouldRefreshScore = true;
  }

  if (shouldRefreshScore) {
    updateScore();
  }

  if (isWordMatched) {
    setNextWord();
  }
});

restartButton.addEventListener("click", restartSession);
trashPreviousButton.addEventListener("click", trashPreviousWord);
definePreviousButton.addEventListener("click", definePreviousWord);
downloadListsButton.addEventListener("click", downloadUpdatedLists);

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  const key = event.key;
  if (key !== "1" && key !== "2" && key !== "3" && key !== "4") return;

  event.preventDefault();

  if (key === "1" && !trashPreviousButton.disabled) {
    trashPreviousWord();
  } else if (key === "2" && !definePreviousButton.disabled) {
    definePreviousWord();
  } else if (key === "3") {
    downloadUpdatedLists();
  } else if (key === "4") {
    restartSession();
  }
});

updateScore();
updatePreviousWordDisplay();
setDefinitionMessage("");
loadWord();
loadRejectedWords();
