# word-projector
Display song words on-screen for live events, like church services.

Currently fairly specific to a particular schema for hymn and song words.

## Populating song words

The file `data/songs.json` needs to be created and populated with the song words. A sample file is present in `songs.sample.json`.

The `hymns-text-parser.js` script reads in a `.docx` file and outputs JSON that can be piped to `data/songs.json`. The corresponding file `songs.sample.docx` can be used as an example.

### Use the songs in `songs.sample.json`

```bash
cp songs.sample.json data/songs.json
```

### Use the songs in `songs.sample.docx`

```bash
node hymn-text-parser.js songs.sample.docx > data/songs.json
```

### Populate with your own `data/songs.docx` file

```bash
node hymn-text-parser.js data/songs.docx > data/songs.json
```