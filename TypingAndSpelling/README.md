# Typing And Spelling

Simple front-end JavaScript typing app served locally with Python.

Created with Github Copilot

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

When `rejected_words.txt` exists at startup, its words are loaded and preserved; downloads of `rejected_words.txt` include those initial words plus any newly trashed words.

Definition lookup uses retry + fallback behavior:
- Primary source: Datamuse
- Fallback source: DictionaryAPI
- Automatic retry when requests fail or time out

## Project Files

- index.html
- styles.css
- app.js

## Run Locally With Python

Open Git Bash in this folder, then run one of these:

```bash
python -m http.server 8000
```

If your Git Bash uses python3 instead:

```bash
python3 -m http.server 8000
```

If neither command works in Git Bash, use your verified full Python path:

```bash
"c:/Users/Jason/AppData/Local/Python/pythoncore-3.14-64/python.exe" -m http.server 8000
```

Then open:

- http://localhost:8000

Press Ctrl+C in Git Bash to stop the server.

## Git Bash Setup On Windows

1. Verify Python is installed:

```bash
python --version
```

If that fails, try:

```bash
python3 --version
```

2. If both fail, install Python from python.org and make sure "Add python.exe to PATH" is checked during install.

3. Confirm Git Bash can find Python:

```bash
command -v python
command -v python3
```

4. Optional convenience function in ~/.bashrc (auto-detects python command):

```bash
cat >> ~/.bashrc <<'EOF'
pyserve() {
	if command -v python >/dev/null 2>&1; then
		python -m http.server "${1:-8000}"
	elif command -v python3 >/dev/null 2>&1; then
		python3 -m http.server "${1:-8000}"
	else
		"c:/Users/Jason/AppData/Local/Python/pythoncore-3.14-64/python.exe" -m http.server "${1:-8000}"
	fi
}
EOF
source ~/.bashrc
```

Then you can run:

```bash
pyserve
pyserve 9000
```

## Notes

- `words.txt` must be one word/phrase per line.
- Replace `words.txt` and `rejected_words.txt` with downloaded updated lists.
