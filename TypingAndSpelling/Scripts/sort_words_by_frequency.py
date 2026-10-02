import sys
from itertools import dropwhile

def load_frequencies(freq_path):
    """
    Reads a tab-delimited frequency file (`word\\tfreq` per line).
    Returns freq_map: dict word -> frequency (float).
    Reports any line that fails to parse.
    """
    freq_map = {}
    errors = []

    with open(freq_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            raw_line = line.rstrip("\n")
            if not raw_line:
                continue

            parts = raw_line.split("\t")
            if len(parts) < 2:
                errors.append(f"Line {line_num}: missing tab-delimited frequency -> {raw_line!r}")
                continue

            word = parts[0]
            try:
                freq_map[word] = float(parts[1])
            except ValueError:
                errors.append(f"Line {line_num}: could not parse frequency {parts[1]!r} -> {raw_line!r}")

    return freq_map, errors

def load_ESDB(words_path, remove_proper_nouns):
    """
    Reads a newline delimited word file.
    Yields words, omitting the header and optionally leading proper nouns.
    """
    words = []
    with open(words_path, "r", encoding="utf-8") as f:
        lines = (line.rstrip("\n") for line in f if line.rstrip("\n"))

        lines = dropwhile(lambda line: line != "---", lines)
        next(lines, None)  # Skip the delimiter
        if remove_proper_nouns:
            lines = dropwhile(lambda line: line[0].isupper(), lines)

        yield from lines

def sort_words_by_frequency(words_path, freq_path, found_out_path, missing_out_path):
    freq_map, parse_errors = load_frequencies(freq_path)
    words = load_ESDB(words_path, remove_proper_nouns=True)

    found = []
    missing = []

    for word in words:
        if word in freq_map:
            found.append((word, freq_map[word]))
        else:
            missing.append(word)

    found.sort(key=lambda entry: entry[1], reverse=True)  # highest frequency first

    with open(found_out_path, "w", encoding="utf-8") as f:
        for word, _ in found:
            f.write(word + "\n")

    with open(missing_out_path, "w", encoding="utf-8") as f:
        for word in missing:
            f.write(word + "\n")

    print(f"Found and sorted: {len(found)} words")
    print(f"Not found in frequency list: {len(missing)} words")

    if parse_errors:
        print(f"\n{len(parse_errors)} parse error(s) in frequency file:")
        for err in parse_errors:
            print("  " + err)
    else:
        print("\nNo parse errors in frequency file.")

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python sort_by_frequency.py <words_file> <freq_file> <found_output> <missing_output>")
        sys.exit(1)
    sort_words_by_frequency(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
