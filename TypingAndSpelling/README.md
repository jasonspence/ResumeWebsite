# Typing And Spelling

Simple front-end JavaScript typing app.

Created with Github Copilot

20,000 English Words list obtained from eyturner: https://gist.github.com/eyturner/3d56f6a194f411af9f29df4c9d4a4e6e

The app loads a random word from `words.txt`, advances when your typed text matches it, and tracks:
- words passed
- streak (resets to 0 when deleting characters)
- letters typed
- letters removed (Backspace/Delete when characters are actually removed)
- efficiency as net letters over total letters (`(typed - removed) / typed`)
- top streak

It also includes a `Previous Word` card with:
- `Move To Trash` to remove that word from the active in-memory list
- `Define Previous Word` to fetch definitions (Datamuse first, DictionaryAPI as backup)
- `Download Updated Lists` to export both the current smaller `words.txt` and an alphabetically sorted `rejected_words.txt`

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
