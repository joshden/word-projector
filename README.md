# word-projector

Display song words on-screen for live events, like church services.

It is a web-based app that provides presenter and presentation views for displaying the words.

It is currently fairly specific to a particular schema for hymn and song words.

## Install

With [Node.js](https://nodejs.org) installed,

```bash
npm install
```

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

### Populate with all .docx files in `data/files/Hymns`

```bash
node hymn-text-parser.js 'data/files/Hymns/*.docx' > data/songs.json
```

### Populate with all .docx files in `data/files/Hymns.zip`

```bash
node hymn-text-parser.js 'data/files/Hymns.zip' > data/songs.json
```

## Running word-projector

1. In the root directory (with this README), start the server:

    ```bash
    npm start
    ```

    e.g.

    ```
    Starting up http-server, serving ./
    Available on:
      http://192.168.8.22:8080
      http://127.0.0.1:8080
    Hit CTRL-C to stop the server
    ```

1. In a browser, navigate to http://localhost:8080/ (or whatever port it was started on)