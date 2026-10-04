const wordInput = document.getElementById("wordInput");
const restartButton = document.getElementById("restartButton");
const developerModeButton = document.getElementById("developerModeButton");
const trashPreviousButton = document.getElementById("trashPreviousButton");
const definePreviousButton = document.getElementById("definePreviousButton");
const downloadListsButton = document.getElementById("downloadListsButton");
const scoreDisplay = document.getElementById("scoreDisplay");
const efficiencyDisplay = document.getElementById("efficiencyDisplay");
const feedback = document.getElementById("feedback");
const shortcutHint = document.querySelector(".shortcutHint");
const promptWordEl = document.getElementById("promptWord");
const previousWordEl = document.getElementById("previousWord");
const definitionDisplay = document.getElementById("definitionDisplay");

let currentWord = "";
let currentWordUnsanitized = "";
let words = [];
let wordsPassed = 0;
let streak = 0;
let topStreak = 0;
let lettersTyped = 0;
let lettersRemoved = 0;
let previousInputValue = "";
let pendingInsertedChars = 0;
let previousWord = "";
let previousWordUnsanitized = "";
let rejectedWords = [];
let developerMode = false;
let currentWordHadMistake = false;
let wordsLoaded = false;
let rejectedWordsLoaded = false;
let wordsLoadSucceeded = false;
const definitionCache = new Map();
const LOOKUP_TIMEOUT_MS = 8000;
const LOOKUP_TIMEOUT_ATTEMPTS = 2;

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

function sanitizeWord(word) {
  return word.replace(/[^\p{L} "'.,;-]/gu, "").toLowerCase();
}

function getInsertedCharCount(event) {
  if (!event.inputType?.startsWith("insert")) return 0;
  if (typeof event.data === "string") return event.data.length;
  return 0;
}

function updateScore() {
  const netLetters = lettersTyped - lettersRemoved;
  const efficiencyPercent = lettersTyped === 0 ? 0 : (netLetters / lettersTyped) * 100;

  scoreDisplay.textContent = `Words typed: ${wordsPassed} | Streak: ${streak} | Correct letters: ${netLetters} | Mistakes: ${lettersRemoved}`;
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

function flashInputError() {
  wordInput.classList.remove("input-error-flash");
  void wordInput.offsetWidth;
  wordInput.classList.add("input-error-flash");
}

function updateDeveloperModeDisplay() {
  developerModeButton.textContent = developerMode ? "Exit Developer Mode" : "Developer Mode";
  developerModeButton.setAttribute("aria-pressed", String(developerMode));
  trashPreviousButton.hidden = !developerMode;
  downloadListsButton.hidden = !developerMode;
  shortcutHint.textContent = developerMode
    ? "Shortcuts: 0 Restart | 1 Define | 2 Trash | 3 Download Lists"
    : "Shortcuts: 0 Restart | 1 Define";
}

function updateDownloadAvailability() {
  downloadListsButton.disabled = !wordsLoaded || !rejectedWordsLoaded || !wordsLoadSucceeded;
}

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
        definitions.push(formatted)
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

async function fetchDefinitionFromFreeDictionaryApi(word) {
  const url = `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}`
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

async function lookupDefinition(word) {
  const cacheKey = word.toLowerCase();
  if (definitionCache.has(cacheKey)) {
    return definitionCache.get(cacheKey);
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
        definitionCache.set(cacheKey, result);
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

async function definePreviousWord() {
  if (!previousWord) {
    console.error("definePreviousWord called without a previous word");
    definePreviousButton.disabled = true;
    return;
  }

  definePreviousButton.disabled = true;
  setDefinitionMessage("Looking up definition...", "loading");

  const lookupWord = previousWord;

  try {
    const result = await lookupDefinition(lookupWord);
    if (lookupWord !== previousWord) return;
    setDefinitionMessage(`${result.source} definition of ${lookupWord}:\n${result.definition}`, "success");
  } catch (error) {
    console.error("Definition lookup failed", { word: lookupWord, error });
    if (lookupWord !== previousWord) return;
    setDefinitionMessage(`${lookupWord}: Could not find definition.`, "error");
    definePreviousButton.disabled = false;
  }
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
  if (downloadListsButton.disabled) return;

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
    wordsLoadSucceeded = true;
  } catch (error) {
    promptWordEl.textContent = "Unavailable";
    feedback.textContent = error.message;
    feedback.className = "status error";
  } finally {
    wordsLoaded = true;
    updateDownloadAvailability();
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
  } finally {
    rejectedWordsLoaded = true;
    updateDownloadAvailability();
  }
}

function removeWordFromActiveList(wordToRemove) {
  words = words.filter((word) => word !== wordToRemove);
}

function setNextWord() {
  if (currentWord) {
    previousWord = currentWord;
    previousWordUnsanitized = currentWordUnsanitized;
    updatePreviousWordDisplay();
  }

  while (words.length > 0) {
    currentWordUnsanitized = pickRandomWord(words);
    currentWord = sanitizeWord(currentWordUnsanitized);

    if (currentWord) {
      promptWordEl.textContent = currentWord;
      wordInput.value = "";
      previousInputValue = "";
      pendingInsertedChars = 0;
      currentWordHadMistake = false;
      feedback.textContent = "";
      feedback.className = "";
      return true;
    }

    rejectedWords.push(currentWordUnsanitized);
    removeWordFromActiveList(currentWordUnsanitized);
  }

  currentWord = "";
  currentWordUnsanitized = "";
  promptWordEl.textContent = "";
  wordInput.value = "";
  previousInputValue = "";
  pendingInsertedChars = 0;
  currentWordHadMistake = false;
  feedback.textContent = "No words left in active list.";
  feedback.className = "status error";
  return false;
}

function restartSession() {
  developerMode = false;
  updateDeveloperModeDisplay();

  wordsPassed = 0;
  streak = 0;
  topStreak = 0;
  lettersTyped = 0;
  lettersRemoved = 0;
  previousInputValue = "";
  pendingInsertedChars = 0;
  previousWord = "";
  previousWordUnsanitized = "";
  feedback.textContent = "";
  feedback.className = "";
  setDefinitionMessage("");
  updatePreviousWordDisplay();
  updateScore();

  currentWord = "";
  currentWordUnsanitized = "";
  setNextWord();
}

function trashPreviousWord() {
  if (!previousWord) {
    console.error("trashPreviousWord called without a previous word");
    trashPreviousButton.disabled = true;
    return;
  }

  trashPreviousButton.disabled = true;

  const trashedWord = previousWord;
  const trashedWordUnsanitized = previousWordUnsanitized;
  rejectedWords.push(trashedWordUnsanitized);
  removeWordFromActiveList(trashedWordUnsanitized);

  if (currentWordUnsanitized === trashedWordUnsanitized) {
    currentWord = "";
    currentWordUnsanitized = "";
    const hasNextWord = setNextWord();
    if (!hasNextWord) return;  // Don't overwrite error messages
  }

  feedback.textContent = `${trashedWord} moved to trash list.`;
  feedback.className = "status success";
}

wordInput.addEventListener("beforeinput", (event) => {
  pendingInsertedChars = getInsertedCharCount(event);
});

wordInput.addEventListener("input", () => {
  if (!currentWord) return;

  const currentValue = wordInput.value.toLowerCase();
  const lengthDelta = currentValue.length - previousInputValue.length;
  let insertedChars = pendingInsertedChars;
  if (insertedChars === 0 && lengthDelta > 0) {
    insertedChars = lengthDelta;
  }
  let removedChars = Math.max(previousInputValue.length + insertedChars - currentValue.length, 0);
  const isWordMatched = currentValue === currentWord;
  const isValidPrefix = insertedChars <= 0 || currentWord.startsWith(currentValue);
  let shouldRefreshScore = false;

  if (insertedChars > 0) {
    lettersTyped += insertedChars;
    shouldRefreshScore = true;
  }

  if (removedChars > 0) {
    lettersRemoved += removedChars;
    currentWordHadMistake = true;
    shouldRefreshScore = true;
  }

  if (!isValidPrefix) {
    currentWordHadMistake = true;
    flashInputError();
  }

  previousInputValue = currentValue;
  pendingInsertedChars = 0;

  if (isWordMatched) {
    const hadMistake = currentWordHadMistake;
    wordsPassed += 1;
    if (hadMistake) {
      streak = 0;
    } else {
      streak += 1;
      if (streak > topStreak) {
        topStreak = streak;
      }
    }
    shouldRefreshScore = true;

    const hasNextWord = setNextWord();
    if (hadMistake && hasNextWord) {
      feedback.textContent = "Word completed, but not perfectly typed.";
      feedback.className = "status error";
    }
  }

  if (shouldRefreshScore) {
    updateScore();
  }
});

restartButton.addEventListener("click", restartSession);
trashPreviousButton.addEventListener("click", trashPreviousWord);
definePreviousButton.addEventListener("click", definePreviousWord);
downloadListsButton.addEventListener("click", downloadUpdatedLists);

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  const key = event.key;
  if (key !== "0" && key !== "1" && key !== "2" && key !== "3") return;

  if ((key === "2" || key === "3") && !developerMode) return;

  event.preventDefault();

  if (key === "0") {
    restartSession();
  } else if (key === "1" && !definePreviousButton.disabled) {
    definePreviousWord();
  } else if (key === "2" && !trashPreviousButton.disabled && !trashPreviousButton.hidden) {
    trashPreviousWord();
  } else if (key === "3" && !downloadListsButton.disabled && !downloadListsButton.hidden) {
    downloadUpdatedLists();
  }
});

developerModeButton.addEventListener("click", () => {
  developerMode = !developerMode;
  updateDeveloperModeDisplay();
});

updateScore();
updateDeveloperModeDisplay();
updatePreviousWordDisplay();
setDefinitionMessage("");
loadWord();
loadRejectedWords();
