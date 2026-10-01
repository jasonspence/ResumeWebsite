# Typing And Spelling

Simple front-end JavaScript typing app.

Created with Github Copilot

20,000 English Words list obtained from eyturner: https://gist.github.com/eyturner/3d56f6a194f411af9f29df4c9d4a4e6e

The app randomly selects a raw entry from `words.txt`, sanitizes it for practice, and advances when your typed text matches it. Entries that become empty after sanitization are automatically moved to `rejected_words.txt` in memory. The app tracks:
- words passed
- streak (resets to 0 when deleting characters)
- letters typed
- letters removed (Backspace/Delete when characters are actually removed)
- efficiency as net letters over total letters (`(typed - removed) / typed`)
- top streak

Sanitized words are created by removing all characters except letters, spaces, double quotes, apostrophes, periods, commas, hyphens, and semicolons. The original raw entry is retained for trashing and downloading.

It also includes a `Previous Word` card with:
- `Developer Mode` to reveal developer-only trash and download controls
- `Define Previous Word` to fetch definitions (Datamuse first, DictionaryAPI as backup)
- `Move To Trash` to remove that word from the active in-memory list
- `Download Updated Lists` to export both the current smaller `words.txt` and an alphabetically sorted `rejected_words.txt`

Keyboard shortcuts are `0` for restart, `1` for defining the previous word, `2` for trashing the previous word, and `3` for downloading the updated lists. The trash and download shortcuts only work in Developer Mode; otherwise `2` and `3` can be typed normally.

The download control remains unavailable until both word lists have finished loading.

Trashed words won't save permanently. At the end of a session, download the updated lists and manually copy them into the source code.

## Project Files

- index.html
- styles.css
- app.js

## Run Locally With Python

Open Git Bash in this folder, then run one of these:

```bash
python -m http.server 8000
# OR
python3 -m http.server 8000
```

Then in a browser, open:

- http://localhost:8000

Press Ctrl+C in Git Bash to stop the server.

## Notes

- `words.txt` must be one word/phrase per line.

## TODO

- Replace random draw with frequency-based draw that weights failed words higher.
- Replace random draw with frequency-based draw that weights failed letters higher.
- Indicate with red colour immediately upon a mistake.
- Allow for dictionary search after trashing word.
