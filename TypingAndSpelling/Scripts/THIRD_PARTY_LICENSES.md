# Third-Party Data Licenses

This file covers licensing for **third-party data** used by this project. It
does not apply to this project's own source code, which is licensed
separately (see the main [README.md](README.md)).

## Word List: English Speller Database (ESDB)

Custom wordlist generated from https://app.aspell.net/create using
the English Speller Database (ESDB) with parameters:
- Size: 35 (small)
- Spelling: CA
- Variant Level: 1
- Special: none
- Diacritics: strip

https://wordlist.aspell.net

ESDB Git Revision: Wed Jun 24 14:30:42 2026 -0400 [1e5b7d3]
App Git Revision: Thu Jun 25 15:43:51 2026 -0400 [156fb4e]

Copyright 2000-2026 by Kevin Atkinson

Permission to use, copy, modify, distribute, and sell any part of the English
Speller Database (ESDB, previously known as SCOWLv2), or word lists
created from it, is hereby granted without fee, provided that the above
copyright notice appears in all copies and that both the above copyright
notice and this notice appear in supporting documentation.  Kevin Atkinson
makes no representations about the suitability of this database for any
purpose.  It is provided "as is" without express or implied warranty.

ESDB is derived from many sources, most of which are in the Public Domain.
Data from the Corpus of Contemporary American English (COCA) was also used.

All data from COCA comes from 3-gram data that is not freely available;
however, the usage is within the rights given by the NDA that was signed when
purchasing the data.  More information on COCA is available at
https://www.english-corpora.org/coca/.

The primary source of words for ESDB comes from 12dicts and ENABLE2K.  Both
are in the Public Domain, but Alan Beale <biljir@pobox.com> deserves special
credit as he is the author of 12dicts and a major contributor to ENABLE2K.  In
addition, he gave me an incredible amount of feedback and created a number of
special lists in order to help improve the overall quality of ESDB.

## Frequency Data: Peter Norvig's `count_1w.txt` (Not Distributed)

The included word list (`text.txt`) was sorted using word frequency counts
from Peter Norvig's `count_1w.txt`, accompanying the chapter "Natural
Language Corpus Data" in *Beautiful Data* (Segaran and Hammerbacher, 2009),
available at https://norvig.com/ngrams/.

That page states: "Code copyright (c) 2008-2009 by Peter Norvig. You are
free to use this code under the MIT license." This license covers Norvig's
*code* (`ngrams.py`), not the `count_1w.txt` data file itself. The data is
in turn derived from the Google Web Trillion Word Corpus, distributed via
the Linguistic Data Consortium (LDC), whose own redistribution terms are
not addressed on that page.

Because no explicit redistribution license is given for this data:

- `count_1w.txt` is **not included** in this repository.
- The frequency values themselves are **not included** in `text.txt`; the
  data was used only at build time to determine word order and inclusion.
- See the README for instructions to download `count_1w.txt` yourself and
  regenerate `text.txt` from source.