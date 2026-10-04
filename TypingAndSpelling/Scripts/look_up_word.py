import sys
import requests

def look_up_with_datamuse(word):
    response = requests.get(
        "https://api.datamuse.com/words",
        params={
            "sl": word,
            "md": "dr",
            "ipa": 1,
            "max": 5,
        },
    )

    response.raise_for_status()
    for result in response.json():
        if result.get("word") != word:
            continue
        pretty_print_json(result)
        print("Datamuse:", word)
        for i, definition in enumerate(result.get("defs")):
            print(f"    {i+1}: {definition.replace("\t", " ")}")

def look_up_with_dictionaryapi(word):
    response = requests.get(
        f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
    )

    response.raise_for_status()
    for result in response.json():
        print(result)

def look_up_with_freedictionaryapi(word):
    response = requests.get(
        f"https://freedictionaryapi.com/api/v1/entries/en/{word}"
    )

    response.raise_for_status()
    # pretty_print_json(response.json())
    print("Free Dictionary API:", word)
    for entry in response.json().get("entries"):
        print(f"{entry.get("partOfSpeech")}:")
        for i, definition in enumerate(entry.get("senses")):
            print(f"    {i+1}: {definition.get("definition")} (", ", ".join(definition.get("tags")), ")", sep="")
        
def pretty_print_json(data):
    import json
    print(json.dumps(data, indent=4, ensure_ascii=False))

def look_up_word(word):
    # look_up_with_datamuse(word)
    # print()
    look_up_with_freedictionaryapi(word)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python look_up_word.py <word>")
        sys.exit(1)
    look_up_word(sys.argv[1])