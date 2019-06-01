# word-projector

Display song words on-screen for live events, like church services.

It is a web-based app that provides presenter and presentation views for displaying the words.

It is currently fairly specific to a particular schema for hymn and song words.

## Install

With [Node.js](https://nodejs.org) installed,

```bash
npm i -g ts-node
npm install
npm run build
```

## Populating song words

The file `data/songs.json` needs to be created and populated with the song words. A sample file is present in `songs.sample.json`.

The `hymns-text-parser.ts` script reads in `.docx` files and outputs JSON that can be piped to `data/songs.json`. The corresponding file `songs.sample.docx` can be used as an example.

### Use the songs in `songs.sample.json`

```bash
cp songs.sample.json data/songs.json
```

### Use the songs in `songs.sample.docx`

```bash
ts-node hymn-text-parser.ts songs.sample.docx > data/songs.json
```

### Populate with your own `data/songs.docx` file

```bash
ts-node hymn-text-parser.ts data/songs.docx > data/songs.json
```

### Populate with all .docx files in `data/files/Hymns`

```bash
ts-node hymn-text-parser.ts 'data/files/Hymns/*.docx' > data/songs.json
```

### Populate with all .docx files in `data/files/Hymns.zip`

```bash
ts-node hymn-text-parser.ts 'data/files/Hymns.zip' > data/songs.json
```

## Specify CCLI license (optional)

```bash
cp ccli.sample.json data/ccli.json
```

Change the 0 to your license number. Must be a JSON number value.

## Running word-projector

1. In the root directory (with this README), start the server:

    ```bash
    npm start
    ```

    e.g.

    ```text
    > word-projector@1.0.0 start C:\Users\Joshd\word-projector
    > ts-node server.ts

    Listening on http://192.168.8.35:8080
    ```

1. In a browser, navigate to <http://localhost:8080/>

## Developer guide

word-projector uses webpack for asset bundlinng. Front-end code needs to be built from the TypeScript sources. Use `npm run build` to build it or `npm run build -- --watch` to build as you make changes to the sources.
