import { lookupDefinition } from "./dictionary.js";

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

function pickRandomWord(wordList) {
  if (wordList.length <= 0) return null;

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
  return word.toLowerCase();
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

function setFeedbackMessage(message, status = "") {
  feedback.textContent = message;
  feedback.className = status ? `status ${status}` : "status";
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

async function loadWords() {
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
    setFeedbackMessage(error.message, "error");
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

function chooseNextWord() {
  let chosenWord = null;

  // Choose from several options
  chosenWord = pickRandomWord(words);

  return chosenWord;
}

function setNextWord() {
  if (currentWord) {
    previousWord = currentWord;
    previousWordUnsanitized = currentWordUnsanitized;
    updatePreviousWordDisplay();
  }

  clearWordInput();
  currentWordHadMistake = false;
  
  currentWordUnsanitized = chooseNextWord(words);
  if (currentWordUnsanitized === null) {
    currentWordUnsanitized = "";
    currentWord = "";
    promptWordEl.textContent = "";
    setFeedbackMessage("No words left in active list.", "error");
    return false;
  }
  currentWord = sanitizeWord(currentWordUnsanitized);
  promptWordEl.textContent = currentWord;
  setFeedbackMessage("");
  return true;
}

function clearWordInput() {
  wordInput.value = "";
  previousInputValue = "";
  pendingInsertedChars = 0;
}

function clearStats() {
  wordsPassed = 0;
  streak = 0;
  topStreak = 0;
  lettersTyped = 0;
  lettersRemoved = 0;
}

function restartSession() {
  developerMode = false;
  updateDeveloperModeDisplay();

  clearStats();
  previousWord = "";
  previousWordUnsanitized = "";
  setFeedbackMessage("");
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

  setFeedbackMessage(`${trashedWord} moved to trash list.`, "success");
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
      setFeedbackMessage("Word completed, but not perfectly typed.", "error");
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
loadWords();
loadRejectedWords();
