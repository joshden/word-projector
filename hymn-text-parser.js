const getDocxTextLines = require('./docx-text-lines');
const glob = require('glob');

const pattern = process.argv[2];

if (typeof pattern !== 'string' || pattern.trim() === '') {
    console.log('Usage: hymn-text-parser docx-file-path');
    console.log('  e.g. node hymn-text-parser.js data/#1-25.docx');
    console.log(`       node hymn-text-parser.js 'data/docx/#*.docx'`);
    process.exit();
}

const songLocations = {
    before: 0,
    afterTitle: 1,
    afterScripture: 2,
    afterAuthor: 3,
    afterTune: 4,
    inStanzas: 5,
    skipToNextSong: 6
};

const songs = [];
const errors = [];
let id = 0;

glob(pattern, (err, files) => {
    if (err) throw err;

    let promise = Promise.resolve();

    files.forEach(path => {
        promise = promise.then(() => getDocxTextLines(path)).then(lines => {
            // console.log(JSON.stringify(lines, null, 2));
            let currentSong = null;
            let currentStanza = null;
            let currentSongLocation = songLocations.before;
        
            lines.forEach((line, i) => {
                line = line.trimRight();
                i++;
                // console.log(line); return;
                if (currentSongLocation <= songLocations.before && line.length < 1) {
                    return;
                }

                function lineError(message) {
                    errors.push({path: path, lineNum: i, message: message});
                    currentSongLocation = songLocations.skipToNextSong;
                }
                function songError(message) {
                    errors.push({path: path, lineNum: i, majestyNumber: currentSong.majestyNumber, message: message});
                    currentSongLocation = songLocations.skipToNextSong;
                }
                function songWarning(message) {
                    errors.push({path: path, lineNum: i, majestyNumber: currentSong.majestyNumber, message: message, warning: true});
                }
        
                const startOfSongMatch = line.match(/^#(\d+) (.+)$/);
                if (currentSongLocation === songLocations.before || (startOfSongMatch && currentSongLocation >= songLocations.inStanzas)) {
                    if (startOfSongMatch) {
                        currentSong = { id: ++id, title: startOfSongMatch[2], majestyNumber: Number(startOfSongMatch[1]), stanzas: [] };
                        currentStanza = null;
                        currentSongLocation = songLocations.afterTitle;
                        songs.push(currentSong);
                    }
                    else {
                        return lineError(`Expected the title of a song, but found: ${line}`);
                    }
                }

                else if (currentSongLocation === songLocations.skipToNextSong) {
                    return;
                }
        
                else if (startOfSongMatch) {
                    return songError(`Found unexpected title of a song: ${line}`);
                }
        
                else if (currentSongLocation === songLocations.afterTitle) {
                    if (line === 'Blessed be God…the Father of mercies, and the God of all comfort. 2 Corinthians 1:3') {
                        line = 'Blessed be God…the Father of mercies, and the God of all comfort. -2 Corinthians 1:3';
                    }
                    const match = line.trim().match(/^(.+?) -(\w.+)$/);
                    if (! match) {
                        return songError(`Expected scripture quotation, but found: ${line}`);
                    }
                    currentSong.majestyScripture = {reference: match[2], text: match[1]};
                    currentSongLocation = songLocations.afterScripture;
                }
        
                else if (currentSongLocation === songLocations.afterScripture) {
                    line = line.trim();

                    const matchTranslatedBy = line.match(/[;,] (tr\.|translated by) ([^,]+)(, (\d{4})\-(\d{4})?)?$/);
                    if (matchTranslatedBy) {
                        const birthYear = matchTranslatedBy[4] === undefined ? null : Number(matchTranslatedBy[4]);
                        const deathYear = matchTranslatedBy[5] === undefined ? null : Number(matchTranslatedBy[5]);
                        currentSong.translatedBy = {name: matchTranslatedBy[2], birthYear: birthYear, deathYear: deathYear};
                        line = line.substr(0, line.length - matchTranslatedBy[0].length);
                    }

                    const matchAdaptedBy = line.match(/[;,] adapt\.( [Bb]y)? ([^,]+)(, (\d{4})\-(\d{4})?)?$/);
                    if (matchAdaptedBy) {
                        const birthYear = matchAdaptedBy[4] === undefined ? null : Number(matchAdaptedBy[4]);
                        const deathYear = matchAdaptedBy[5] === undefined ? null : Number(matchAdaptedBy[5]);
                        currentSong.adaptedBy = {name: matchAdaptedBy[2], birthYear: birthYear, deathYear: deathYear};
                        line = line.substr(0, line.length - matchAdaptedBy[0].length);
                    }

                    const matchAuthor2 = line.match(/; ([^,]+)(, (\d{4})\-(\d{4})?)?$/);
                    if (matchAuthor2) {
                        const birthYear = matchAuthor2[3] === undefined ? null : Number(matchAuthor2[3]);
                        const deathYear = matchAuthor2[4] === undefined ? null : Number(matchAuthor2[4]);
                        currentSong.author2 = {name: matchAuthor2[1], birthYear: birthYear, deathYear: deathYear};
                        line = line.substr(0, line.length - matchAuthor2[0].length);
                    }

                    const matchAuthorOptionalYears = line.match(/^By ([^,]+)(, (\d{4})\-(\d{4})?)?$/);
                    const matchAuthorAndCentury = line.match(/^By ([^,]+), (18|19|20)th century$/);
                    const matchAuthorNameWithComma = line.match(/^By (.+?), (\d{4})\-(\d{4})$/);
                    if (matchAuthorOptionalYears) {
                        const birthYear = matchAuthorOptionalYears[3] === undefined ? null : Number(matchAuthorOptionalYears[3]);
                        const deathYear = matchAuthorOptionalYears[4] === undefined ? null : Number(matchAuthorOptionalYears[4]);
                        currentSong.author = {name: matchAuthorOptionalYears[1], birthYear: birthYear, deathYear: deathYear};
                    }
                    else if (matchAuthorAndCentury) {
                        currentSong.author = {name: matchAuthorAndCentury[1], century: Number(matchAuthorAndCentury[2])};
                    }
                    else if (matchAuthorNameWithComma) {
                        const birthYear = Number(matchAuthorNameWithComma[2]);
                        const deathYear = Number(matchAuthorNameWithComma[3]);
                        currentSong.author = {name: matchAuthorNameWithComma[1], birthYear: birthYear, deathYear: deathYear};
                    }
                    else if (line === 'Traditional') {
                        currentSong.author = {name: line, birthYear: null, deathYear: null}
                    }
                    else {
                        currentSong.author = line;
                        songWarning(`Expected author info, but found: ${line}`);
                    }
                    currentSongLocation = songLocations.afterAuthor;
                }
        
                else if (currentSongLocation === songLocations.afterAuthor) {
                    const match = line.trim().match(/^Tune: (.+)$/);
                    if (match) {
                        currentSong.tune = match[1];
                        currentSongLocation = songLocations.afterTune;
                    }
                    else {
                        const match = line.trim().match(/^Arr\. (.+?), (\d{4})\-(\d{4})?$/);
                        if (match) {
                            currentSong.arrangedBy = {name: match[1], birthYear: Number(match[2]), deathYear: match[3] === undefined ? null : Number(match[3])};                    
                        }
                        else {
                            const match = line.trim().match(/^Adapted by (.+?), (\d{4})\-(\d{4})?$/);
                            if (match) {
                                currentSong.adaptedBy = {name: match[1], birthYear: Number(match[2]), deathYear: match[3] === undefined ? null : Number(match[3])};                    
                            }   
                            else {
                                return songError(`Expected a tune, but found: ${line}`);
                            }
                        }
                    }
                }
        
                else if (currentSongLocation === songLocations.afterTune && line.length < 1) {
                    return;
                }
        
                else if (currentSongLocation === songLocations.afterTune || currentSongLocation === songLocations.inStanzas) {
                    const match = line.trim().match(/^(\d+)\. (.+)$/);
                    if (match) {
                        const verseNumber = Number(match[1]);
                        const restOfLine = match[2];
                        if (currentStanza && currentStanza.majestyVerse + 1 !== verseNumber) {
                            return songError(`Expected stanza #${currentStanza.majestyVerse + 1}, but found: ${line}`);
                        }
                        currentStanza = { majestyVerse: verseNumber, lines: [restOfLine] };
                        if (! currentSong.stanzas.length) {
                            currentSongLocation = songLocations.inStanzas;
                        }
                        currentSong.stanzas.push(currentStanza);
                    }
                    else {
                        if (! currentStanza) {
                            return songError(`Expected the beginning of a stanza, but found: ${line}`);
                        }
                        else if (line.trim().startsWith('© Copyright')) {
                            currentSong.copyright = line.trim();
                            currentStanza = null;
                            currentSong = null;
                            currentSongLocation = songLocations.before;
                        }
                        else {
                            currentStanza.lines.push(line);
                        }
                    }
                }
            });
        }).catch(msg => errors.push({path: path, message: msg}));
    });

    promise.then(() => {
        songs.forEach(song => {
            song.stanzas.forEach(stanza => {
                const lines = stanza.lines;
                while (lines.length > 0 && lines[lines.length-1].length < 1) {
                    lines.pop();
                }
            });
        });

        if (errors.filter(e => !e.warning).length) {
            process.exitCode = 1;
            errors.forEach(error => {
                console.error(error);
            });
        }
        else {
            console.log(JSON.stringify(songs, null, 2));
        }
    });
});