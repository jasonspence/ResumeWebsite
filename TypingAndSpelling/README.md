# Typing And Spelling

A typing app to learn words.
Try it out on [my website](https://www.jasonspence.ca/TypingAndSpelling/)

## Data Attribution
 
This project uses a word list derived from the **English Speller Database
(ESDB)**, generated via [app.aspell.net](https://app.aspell.net/create).
 
ESDB is © 2000–2026 Kevin Atkinson, used here under its permissive license.
See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for the full copyright
and license notice, which applies only to the included word list data, not
to this app's own source code.
 
Word ordering was informed by frequency data from Peter Norvig's
[`count_1w.txt`](https://norvig.com/ngrams/count_1w.txt) (from *Beautiful
Data*, 2009). That frequency data is **used as a build-time tool only**, is
**not included** in this repository, and no frequency values appear in the
committed output — see [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)
for why this distinction matters.

Definitions are performed via real-time lookup, using [freedictionaryapi.dev](https://freedictionaryapi.com/), with [datamuse.com](https://www.datamuse.com/) as a backup.

## Features

- A customized 35,000+ word list
- Live stats for both words and letters
- Built-in dictionary (requires internet) to look up definitions without leaving the app
- Immediate mistake feedback (flashing red text field)
- Keyboard shortcuts for restarting & searching a definition
- Developer mode to modify word lists and download updated lists
- Responsive design for mobile and desktop

## How It Works

The app randomly selects a raw entry from `words.txt`, sanitizes it for practice, and advances when your typed text matches it. Sanitized words are stripped of numbers and most symbols, and are case-insensitive.

The app tracks your typing stats:
- words typed
- streak (resets to 0 when a word is completed after making mistakes)
- correct letters (only counts correct letters)
- mistakes (letters removed)
- efficiency as correct letters over total letters (`(typed - removed) / typed`)
- highest streak

Typing an incorrect character or deleting characters marks that word as imperfect, which resets the current streak. Completing a word without mistakes advances the streak normally.

After completing a word, find out its definition by clicking `Define Previous Word` to fetch definitions from online dictionary APIs.

Keyboard shortcuts are `0` to restart, and `1` for defining the previous word. 

## Developer Notes

### Editing the Word List

To reject words from the word list as you type, open `Developer Mode` by clicking the button on the **Previous Word** card. 
After completing a word, a new "trash" button and keyboard shortcut `2` will be available to automatically move that word to a rejected words list. Entries that become empty after sanitization are also automatically trashed. The original unsanitized entry is retained for these manipulations.

Trashed words won't save permanently. At the end of a session, download the updated lists and manually copy them into the source code. 
The keyboard shortcut to download the lists is `3`.
Note that the download control remains unavailable until the word list and the previously rejected word list have finished loading.

### Rebuilding `words.txt` From Scratch
 
1. Download `count_1w.txt` from
   https://norvig.com/ngrams/count_1w.txt
2. Run `python ./Scripts/sort_words_by_frequency.py ./Scripts/ESDB_35_CA.txt count_1w.txt words.txt missing.txt`
   - this strips the ESDB header automatically, removes proper nouns, and sorts the result by frequency
3. `words.txt` is the final word list; `missing.txt` lists any ESDB words not
   found in the frequency data (for review)


## Project Files

- `index.html`
- `styles.css`
- `app.js`
- `words.txt` — Default word list: proper nouns removed, filtered and sorted by frequency
- `Scripts/`
    - `ESDB_35_CA.txt` — Raw downloaded word list from ESDB (size 35, CA spelling)
    - `sort_words_by_frequency.py` — Script to generate `words.txt`
    - `look_up_word.py` — Sandbox script to test dictionary API responses


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
- Display dictionary results from all dictionaries.
- Add helper setFeedbackMessage function
