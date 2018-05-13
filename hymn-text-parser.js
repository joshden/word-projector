const getDocxTextLines = require('./docx-text-lines');
const glob = require('glob');
const fs = require('fs');

const pattern = process.argv[2];

if (typeof pattern !== 'string' || pattern.trim() === '') {
    console.log('Usage: hymn-text-parser docx-file-path');
    console.log('  e.g. node hymn-text-parser.js data/#1-25.docx');
    console.log(`       node hymn-text-parser.js 'data/docx/#*.docx'`);
    console.log('');
    console.log(`  Note: The single quotes might be required to prevent`);
    console.log(`        the shell from glob'ing a single file.`);
    process.exit();
}

const songLocations = {
    before: 0,
    afterTitle: 1,
    afterScripture: 2,
    afterFirstAuthor: 3,
    afterHeader: 4,
    inStanzas: 5,
    skipToNextSong: 6
};

const songs = [];
const errors = [];
let id = 0;

glob(pattern, (err, files) => {
    if (err) throw err;

    let promise = Promise.resolve();

    files.filter(file => fs.statSync(file).size > 0).forEach(path => {
        promise = promise.then(() => getDocxTextLines(path)).then(lines => {
            // console.log(JSON.stringify(lines, null, 2));
            let currentSong = null;
            let currentStanza = null;
            let isScriptureSong = false;
            let isNonMajestySong = false;
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
        
                const startOfSongMatch = line.match(/^(SS:|#(\d+)) (.+)$/);
                if (currentSongLocation === songLocations.before || (startOfSongMatch && currentSongLocation >= songLocations.inStanzas)) {
                    if (startOfSongMatch) {
                        isScriptureSong = startOfSongMatch[1] === 'SS:';
                        isNonMajestySong = startOfSongMatch[1] === '#0';
                        const majestyNumber = (isScriptureSong || isNonMajestySong) ? undefined : Number(startOfSongMatch[2])
                        currentSong = { id: ++id, title: startOfSongMatch[3], majestyNumber: majestyNumber, stanzas: [] }
                        currentStanza = null;
                        currentSongLocation = isNonMajestySong ? songLocations.afterScripture : songLocations.afterTitle;
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
                    if (isScriptureSong) {
                        const match = line.trim().match(/^-(\w.+)$/);
                        if (! match) {
                            return songError(`Expected scripture song reference, but found: ${line}`);
                        }
                        currentSong.author = { scriptureRef: match[1] };
                        currentSongLocation = songLocations.afterHeader;
                    }
                    else {
                        const match = line.trim().match(/^(.+?) -(\w.+)$/);
                        if (match) {
                            currentSong.majestyScripture = {reference: match[2], text: match[1]};
                        }
                        else if (! line.toLowerCase().includes('(no scripture reference)')) {
                            return songError(`Expected scripture quotation, but found: ${line}`);
                        }
                        currentSongLocation = songLocations.afterScripture;
                    }
                }

                else if (currentSongLocation === songLocations.afterScripture || currentSongLocation === songLocations.afterFirstAuthor) {
                    line = line.trim();
                    let author = null;

                    const matchAuthorOptionalYears = line.match(/^By ([^,]+)(, (\d{4})\-(\d{4})?)?$/);
                    const matchAuthorAndCentury = line.match(/^By ([^,]+), (18|19|20)th century$/);
                    const matchAuthorNameWithComma = line.match(/^By (.+?), (\d{4})\-(\d{4})$/);
                    const matchAuthorBornYear = line.match(/^By (.+?), b\. (\d{4})$/);
                    const matchByWithEndingYear = line.match(/^By (.+?), (\d{4})$/);
                    const matchBasedOn = line.match(/^Based on (.+), (\d{4})$/);
                    const matchScripture = line.match(/^Scripture: (.+)$/);
                    const matchStanza = line.match(/^St. (\d(,\d)*) ([^,]+)(, (\d{4})\-(\d{4})?)?$/);
                    const matchTune = line.match(/^Tune: (.+)$/);
                    const matchArrangedBy = line.match(/^Arr\. (.+?), (\d{4})\-(\d{4})?$/);
                    const matchAdaptedBy = line.match(/^Adapted by (.+?), (\d{4})\-(\d{4})?$/);
                    const matchTranslatedBy = line.match(/^Translated by (.+?), (\d{4})\-(\d{4})?$/);
                    const matchVersifiedBy = line.match(/^Versified by (.+?), (\d{4})\-(\d{4})?$/);
                    const matchSource = line.match(/^Source: (.+)$/);

                    if (line.match(/[,;] tr. /i)) {
                        currentSongLocation = songLocations.afterFirstAuthor;
                        songWarning(`Expected translated by info on separate line from author, but found: ${line}`);
                    }
                    else if (line.match(/[,;] arr. /i)) {
                        currentSongLocation = songLocations.afterFirstAuthor;
                        songWarning(`Expected arranged by info on separate line from author, but found: ${line}`);
                    }
                    else if (line.match(/[,;] adapted by /i)) {
                        currentSongLocation = songLocations.afterFirstAuthor;
                        songWarning(`Expected adapted by info on separate line from author, but found: ${line}`);
                    }
                    else if (line.match(/By.*?;/i)) {
                        currentSongLocation = songLocations.afterFirstAuthor;
                        songWarning(`Expected multiple authors on separate lines, but found: ${line}`);
                    }
                    else if (line.match(/\d{4}[^-]/)) {
                        currentSongLocation = songLocations.afterFirstAuthor;
                        songWarning(`Expected only one year or year range on an author line, but found: ${line}`);
                    }
                    if (matchAuthorOptionalYears) {
                        const birthYear = matchAuthorOptionalYears[3] === undefined ? null : Number(matchAuthorOptionalYears[3]);
                        const deathYear = matchAuthorOptionalYears[4] === undefined ? null : Number(matchAuthorOptionalYears[4]);
                        author = {name: matchAuthorOptionalYears[1], birthYear: birthYear, deathYear: deathYear};
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (matchAuthorAndCentury) {
                        author = {name: matchAuthorAndCentury[1], century: Number(matchAuthorAndCentury[2])};
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (matchAuthorNameWithComma) {
                        const birthYear = Number(matchAuthorNameWithComma[2]);
                        const deathYear = Number(matchAuthorNameWithComma[3]);
                        author = {name: matchAuthorNameWithComma[1], birthYear: birthYear, deathYear: deathYear};
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (matchAuthorBornYear) {
                        const birthYear = Number(matchAuthorBornYear[2]);
                        author = {name: matchAuthorBornYear[1], birthYear: birthYear };
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (matchStanza) {
                        const birthYear = matchStanza[5] === undefined ? null : Number(matchStanza[5]);
                        const deathYear = matchStanza[6] === undefined ? null : Number(matchStanza[6]);
                        author = {name: matchStanza[3], birthYear: birthYear, deathYear: deathYear, stanzas: matchStanza[1].split(',').map(s => Number(s))};
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (line === 'Traditional') {
                        author = {traditional: true};
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (matchBasedOn) {
                        author = {basedOn: matchBasedOn[1], year: Number(matchBasedOn[2])};
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (matchScripture) {
                        author = {scripture: matchScripture[1]};
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (matchByWithEndingYear) {
                        author = {byWork: matchByWithEndingYear[1], year: Number(matchByWithEndingYear[2])};
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (matchSource) {
                        author = {source: matchSource[1]};
                        currentSongLocation = songLocations.afterFirstAuthor;
                    }
                    else if (currentSongLocation === songLocations.afterScripture) {
                        author = line;
                        currentSongLocation = songLocations.afterFirstAuthor;
                        songWarning(`Expected author info, but found: ${line}`);
                    }
                    else if (matchTune) {
                        currentSong.tune = matchTune[1];
                        currentSongLocation = songLocations.afterHeader;
                    }
                    else if (matchArrangedBy) {
                        currentSong.arrangedBy = {name: matchArrangedBy[1], birthYear: Number(matchArrangedBy[2]), deathYear: matchArrangedBy[3] === undefined ? null : Number(matchArrangedBy[3])};
                    }
                    else if (matchAdaptedBy) {
                        currentSong.adaptedBy = {name: matchAdaptedBy[1], birthYear: Number(matchAdaptedBy[2]), deathYear: matchAdaptedBy[3] === undefined ? null : Number(matchAdaptedBy[3])};
                    }
                    else if (matchTranslatedBy) {
                        currentSong.translatedBy = {name: matchTranslatedBy[1], birthYear: Number(matchTranslatedBy[2]), deathYear: matchTranslatedBy[3] === undefined ? null : Number(matchTranslatedBy[3])};
                    }
                    else if (matchVersifiedBy) {
                        currentSong.versifiedBy = {name: matchVersifiedBy[1], birthYear: Number(matchVersifiedBy[2]), deathYear: matchVersifiedBy[3] === undefined ? null : Number(matchVersifiedBy[3])};
                    }
                    else if (currentSongLocation >= songLocations.afterFirstAuthor && line.length < 1 && isNonMajestySong) {
                        currentSongLocation = songLocations.afterHeader;
                    }
                    else {
                        songError(`Expected a tune, but found: ${line}`);
                    }

                    if (author) {
                        if (currentSong.author) {
                            if (currentSong.author2) {
                                songWarning(`Ignoring 3rd author that was found: ${author}`);
                            }
                            else {
                                currentSong.author2 = author;
                            }
                        }
                        else {
                            currentSong.author = author;
                        }
                    }
                }
        
                else if (currentSongLocation === songLocations.afterHeader && line.length < 1) {
                    return;
                }
        
                else if (currentSongLocation === songLocations.afterHeader || currentSongLocation === songLocations.inStanzas) {
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

        if (errors./*filter(e => !e.warning).*/length) {
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