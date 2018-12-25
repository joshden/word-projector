import glob from "glob";
import fs from "fs";
import jszip from "jszip";
import Song, { Stanza, Author, BuildingSong } from "./song";
import getDocxTextLines from './docx-text-lines';


const pattern = process.argv[2];

if (typeof pattern !== 'string' || pattern.trim() === '') {
    console.log('Usage: hymn-text-parser docx-file-path');
    console.log('  e.g. node hymn-text-parser.js data/#1-25.docx');
    console.log(`       node hymn-text-parser.js 'data/docx/#*.docx'`);
    console.log(`       node hymn-text-parser.js data/docx/songs.zip`);
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
    afterStanzas: 6,
    skipToNextSong: 7
};

type Error = string | {
    path: string;
    lineNum?: number;
    message: string;
    majestyNumber?: number;
    warning?: boolean;
};

const songs: BuildingSong[] = [];
const errors: Error[] = [];
let id = 0;

glob(pattern, (err, files) => {
    if (err) throw err;

    const promises: Promise<{} | void>[] = [];

    files.filter(file => fs.statSync(file).size > 0).forEach(path => {
        if (path.toLowerCase().endsWith('.zip')) {
            promises.push(new Promise((resolve, reject) => {
                fs.readFile(path, function(err, data) {
                    if (err) {
                        reject(err);
                    }
                    jszip.loadAsync(data).then(zip => {
                        const zippedFiles = zip.filter((path, file) => path.toLowerCase().endsWith('.docx') && (file as any)._data.compressedSize);
                        Promise.all(zippedFiles.map(zippedFile => {
                            const fullPath = path + ':' + zippedFile.name;
                            const data = zippedFile.async('nodebuffer');
                            return handleDocxFile(fullPath, data);
                        }))
                            .catch(err => reject(err))
                            .then(response => resolve(response));
                    });
                });
            }));
        }
        else {
            promises.push(new Promise((resolve, reject) => {
                fs.readFile(path, function(err, data) {
                    if (err) {
                        reject(err);
                    }
                    handleDocxFile(path, data)
                        .catch(err => reject(err))
                        .then(response => resolve(response));
                });

            }));
        }
    });

    Promise.all(promises).then(cleanAndOutputSongs);
    // promise.then(() => cleanAndOutputSongs());
});

function handleDocxFile(path: string, data: Buffer | Promise<Buffer>) {
    return Promise.resolve().then(() => getDocxTextLines(path, data)).then(lines => {
        // console.log(JSON.stringify(lines, null, 2));
        let currentSong: BuildingSong;
        let currentStanza: Stanza | null = null;
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

            function lineError(message: string) {
                errors.push({path: path, lineNum: i, message: message});
                currentSongLocation = songLocations.skipToNextSong;
            }
            function songError(message: string) {
                errors.push({path: path, lineNum: i, majestyNumber: currentSong.majestyNumber, message: message});
                currentSongLocation = songLocations.skipToNextSong;
            }
            function songWarning(message: string) {
                errors.push({path: path, lineNum: i, majestyNumber: currentSong.majestyNumber, message: message, warning: true});
            }
    
            const startOfSongMatch = line.match(/^(SS:|#(\d+)) (.+)$/);
            if (currentSongLocation === songLocations.before || (startOfSongMatch && currentSongLocation >= songLocations.inStanzas)) {
                if (startOfSongMatch) {
                    isScriptureSong = startOfSongMatch[1] === 'SS:';
                    isNonMajestySong = startOfSongMatch[1] === '#0';
                    const majestyNumber = (isScriptureSong || isNonMajestySong) ? undefined : Number(startOfSongMatch[2])
                    currentSong = {
                        id: ++id,
                        title: startOfSongMatch[3],
                        majestyNumber,
                        stanzas: [] as Stanza[]
                    }
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
                    const match = line.trim().match(/^(.+?) [–-](\w.+)$/);
                    if (match) {
                        currentSong.majestyScripture = { reference: match[2], text: match[1] };
                    }
                    else if (! line.toLowerCase().includes('(no scripture reference)')) {
                        return songError(`Expected scripture quotation, but found: ${line}`);
                    }
                    currentSongLocation = songLocations.afterScripture;
                }
            }

            else if (currentSongLocation === songLocations.afterScripture || currentSongLocation === songLocations.afterFirstAuthor) {
                line = line.trim();
                let author: Author | null = null;

                const matchAuthorOptionalYears = line.match(/^By ([^,]+)(, (\d{4})\-(\d{4})?)?$/);
                const matchAuthorAndCentury = line.match(/^By ([^,]+), (18|19|20)th [cC]entury$/);
                const matchAuthorNameWithComma = line.match(/^By (.+?), (\d{4})\-(\d{4})( \(and others\))?$/);
                const matchAuthorNameWithCommaCirca = line.match(/^By (.+?), c. (\d{4})\-(\d{4})$/);
                const matchAuthorBornYear = line.match(/^By (.+?), b\. (\d{4})$/);
                const matchAuthorDeathYear = line.match(/^By (.+?), \?-(\d{4})$/);
                const matchByWithEndingYear = line.match(/^By (.+?), (\d{4})$/);
                const matchBasedOn = line.match(/^Based on (.+), (\d{4})$/);
                const matchScripture = line.match(/^Scripture: (.+)$/);
                const matchStanza = line.match(/^St. (\d(,\d)*) ([^,]+)(, (\d{4})\-(\d{4})?)?$/);
                const matchTune = line.match(/^Tune: (.+)$/);
                const matchArrangedBy = line.match(/^Arr\. (.+?), (\d{4})\-(\d{4})?$/);
                const matchAdaptedBy = line.match(/^Adapted by (.+?), (\d{4})\-(\d{4})?$/);
                const matchTranslatedBy = line.match(/^Translated by (.+?), (\d{4})\-(\d{4})?( and others)?$/);
                const matchVersifiedBy = line.match(/^Versified by (.+?), (\d{4})\-(\d{4})?$/);
                const matchSource = line.match(/^Source: (.+)$/);
                const matchAlteredBy = line.match(/^Altered by (.+?), (\d{4})\-(\d{4})?$/);

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
                else if (line.trim().replace(/ \(?and others\)?$/, '').match(/\d{4}[^-]/)) {
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
                    author = {
                        name: matchAuthorAndCentury[1], 
                        century: Number(matchAuthorAndCentury[2])
                    };
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (matchAuthorNameWithComma) {
                    const birthYear = Number(matchAuthorNameWithComma[2]);
                    const deathYear = Number(matchAuthorNameWithComma[3]);
                    author = {
                        name: matchAuthorNameWithComma[1],
                        birthYear: birthYear,
                        deathYear: deathYear,
                        andOthers: matchAuthorNameWithComma[4] === ' (and others)'
                    };
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (matchAuthorNameWithCommaCirca) {
                    const birthYear = Number(matchAuthorNameWithCommaCirca[2]);
                    const deathYear = Number(matchAuthorNameWithCommaCirca[3]);
                    author = {
                        name: matchAuthorNameWithCommaCirca[1],
                        birthYear, 
                        deathYear,
                        circaYears: true
                    };
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (matchAuthorBornYear) {
                    const birthYear = Number(matchAuthorBornYear[2]);
                    author = {
                        name: matchAuthorBornYear[1],
                        birthYear: birthYear
                    };
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (matchAuthorDeathYear) {
                    const deathYear = Number(matchAuthorDeathYear[2]);
                    author = {
                        name: matchAuthorDeathYear[1],
                        deathYear: deathYear
                    };
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (matchStanza) {
                    const birthYear = matchStanza[5] === undefined ? null : Number(matchStanza[5]);
                    const deathYear = matchStanza[6] === undefined ? null : Number(matchStanza[6]);
                    author = {
                        name: matchStanza[3],
                        birthYear,
                        deathYear,
                        stanzas: matchStanza[1].split(',').map(s => Number(s))
                    };
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (line === 'Traditional') {
                    author = { traditional: true };
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (matchBasedOn) {
                    author = { 
                        basedOn: matchBasedOn[1],
                        year: Number(matchBasedOn[2])
                    };
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (matchScripture) {
                    author = {scripture: matchScripture[1]};
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (matchByWithEndingYear) {
                    author = {
                        byWork: matchByWithEndingYear[1],
                        year: Number(matchByWithEndingYear[2])
                    };
                    currentSongLocation = songLocations.afterFirstAuthor;
                }
                else if (matchSource) {
                    author = { source: matchSource[1] };
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
                    currentSong.arrangedBy = { 
                        name: matchArrangedBy[1], 
                        birthYear: Number(matchArrangedBy[2]), 
                        deathYear: matchArrangedBy[3] === undefined ? null : Number(matchArrangedBy[3])
                    };
                }
                else if (matchAdaptedBy) {
                    currentSong.adaptedBy = {
                        name: matchAdaptedBy[1], 
                        birthYear: Number(matchAdaptedBy[2]), 
                        deathYear: matchAdaptedBy[3] === undefined ? null : Number(matchAdaptedBy[3])
                    };
                }
                else if (matchTranslatedBy) {
                    currentSong.translatedBy = {
                        name: matchTranslatedBy[1], 
                        birthYear: Number(matchTranslatedBy[2]), 
                        deathYear: matchTranslatedBy[3] === undefined ? null : Number(matchTranslatedBy[3]),
                        andOthers: matchTranslatedBy[4] === ' and others'
                    };
                }
                else if (matchVersifiedBy) {
                    currentSong.versifiedBy = {
                        name: matchVersifiedBy[1],
                        birthYear: Number(matchVersifiedBy[2]),
                        deathYear: matchVersifiedBy[3] === undefined ? null : Number(matchVersifiedBy[3])
                    };
                }
                else if (matchAlteredBy) {
                    currentSong.alteredBy = {
                        name: matchAlteredBy[1],
                        birthYear: Number(matchAlteredBy[2]),
                        deathYear: matchAlteredBy[3] === undefined ? null : Number(matchAlteredBy[3])
                    };
                }
                else if (currentSongLocation >= songLocations.afterFirstAuthor && line.length < 1 && isNonMajestySong) {
                    currentSongLocation = songLocations.afterHeader;
                }
                else {
                    songError(`Expected a tune, but found: ${line}`);
                }

                if (author) {
                    if (currentSong.author) {
                        if (! currentSong.otherAuthors) {
                            currentSong.otherAuthors = [];
                        }
                        currentSong.otherAuthors.push(author);
                    }
                    else {
                        currentSong.author = author;
                    }
                }
            }
    
            else if (currentSongLocation === songLocations.afterHeader && line.length < 1) {
                return;
            }
    
            else if (currentSongLocation === songLocations.afterHeader || currentSongLocation === songLocations.inStanzas || currentSongLocation === songLocations.afterStanzas) {
                const stanzaStartMatch = line.trim().match(/^(\d+)\. (.+)$/);
                if (stanzaStartMatch && currentSongLocation < songLocations.afterStanzas) {
                    const verseNumber = Number(stanzaStartMatch[1]);
                    const restOfLine = stanzaStartMatch[2];
                    if (currentStanza && currentStanza.majestyVerse + 1 !== verseNumber) {
                        return songError(`Expected stanza #${currentStanza.majestyVerse + 1}, but found: ${line}`);
                    }
                    currentStanza = { 
                        majestyVerse: verseNumber,
                        lines: [restOfLine]
                    };
                    if (! currentSong.stanzas.length) {
                        currentSongLocation = songLocations.inStanzas;
                    }
                    currentSong.stanzas.push(currentStanza);
                }
                else {
                    const ccliSongNumberMatch = line.trim().match(/^CCLI Song #: (\d+)$/);
                    const ccliWordsCopyrightsMatch = line.trim().match(/^CCLI (Words )?Copyrights: (.+)$/);
                    if (line.trim().startsWith('© Copyright') && ! currentSong.copyright) {
                        currentSong.copyright = line.trim();
                        currentStanza = null;
                        currentSongLocation = songLocations.afterStanzas;
                    }
                    else if (ccliSongNumberMatch && ! currentSong.ccliSongNumber) {
                        currentSong.ccliSongNumber = Number(ccliSongNumberMatch[1]);
                        currentStanza = null;
                        currentSongLocation = songLocations.afterStanzas;
                    }
                    else if (ccliWordsCopyrightsMatch && ! currentSong.ccliWordsCopyrights) {
                        currentSong.ccliWordsCopyrights = ccliWordsCopyrightsMatch[2];
                        currentStanza = null;
                        currentSongLocation = songLocations.afterStanzas;
                        if (currentSong.ccliWordsCopyrights !== 'Public Domain' && ! currentSong.ccliWordsCopyrights.match(/^\d{4}/)) {
                            songWarning(`CCLI Words Copyrights: expected to start with a year, but found ${currentSong.ccliWordsCopyrights}`);
                        }
                    }
                    else if (! currentStanza && currentSongLocation < songLocations.afterStanzas) {
                        return songError(`Expected the beginning of a stanza, but found: ${line}`);
                    }
                    else if (currentSongLocation >= songLocations.afterStanzas) {
                        if (line.trim().length > 0) {
                            return songError(`Found unexpected non-empty line after stanzas: ${line}`);
                        }
                    }
                    else {
                        if (line.toUpperCase().includes('CCLI')) {
                            songWarning(`Possibly invalid CCLI line: ${line.trim()}`);
                        }
                        if (line.includes('©') || line.toLowerCase().includes('copyright')) {
                            songWarning(`Invalid copyright line: ${line.trim()}`);
                        }
                        else if (line.match(/\d/) && ! isScriptureSong) {
                            songWarning(`Potentially invalid verse number: ${line.trim()}`);
                        }
                        else if (currentStanza === null) {
                            songError(`No current stanza to add line to: ${line.trim()}`);
                        }
                        else {
                            currentStanza.lines.push(line);
                        }
                    }
                }
            }
        });
    }).catch(msg => errors.push({path: path, message: msg}));
}

function validateSongFullyBuilt(song: BuildingSong): song is Song {
    const newErrors: Error[] = [];
    if (song.author === undefined) {
        newErrors.push(`Song with no author: ${song.title}`);
    }
    errors.push(...newErrors);
    return newErrors.length < 1;
}

function cleanAndOutputSongs() {
    const majestyNumberCounts = new Map();
    const builtSongs: Song[] = [];
    songs.forEach(song => {
        if (validateSongFullyBuilt(song)) {
            builtSongs.push(song);
        }
        const majestyNumber = song.majestyNumber;
        if (majestyNumber !== undefined) {
            if (! majestyNumberCounts.has(majestyNumber)) {
                majestyNumberCounts.set(majestyNumber, 0);
            }
            majestyNumberCounts.set(majestyNumber, majestyNumberCounts.get(majestyNumber) + 1);
        }
        song.stanzas.forEach(stanza => {
            const lines = stanza.lines;
            while (lines.length > 0 && lines[lines.length-1].length < 1) {
                lines.pop();
            }

            let stanzaExtraBlankLines = false;
            let wasLineMinus1Blank = false;
            let wasLineMinus2Blank = false;

            lines.forEach(line => {
                const isThisLineBlank = line.trim().length === 0;
                if (isThisLineBlank && (wasLineMinus1Blank || wasLineMinus2Blank)) {
                    stanzaExtraBlankLines = true;
                }
                wasLineMinus2Blank = wasLineMinus1Blank;
                wasLineMinus1Blank = isThisLineBlank;
            });

            if (stanzaExtraBlankLines) {
                // errors.push({ message: 'Possibly extra blank lines found', majestyNumber: song.majestyNumber, title: song.title, majestyVerse: stanza.majestyVerse, lines, warning: true });
            }
        });
    });

    majestyNumberCounts.forEach((count, majestyNumber) => {
        if (count > 1) {
            errors.push(`${count} songs had majesty number #${majestyNumber}`);
        }
    });

    if (errors./*filter(e => !e.warning).*/length) {
        process.exitCode = 1;
        console.error(errors.length, 'errors');
        errors.forEach(error => {
            console.error(error);
            console.error();
        });
    }
    else {
        // builtSongs.sort((a, b) => {
        //     if (a.majestyNumber !== b.majestyNumber) {
        //         if (! a.majestyNumber) return 1;
        //         if (! b.majestyNumber) return -1;
        //         return a.majestyNumber - b.majestyNumber;
        //     }
        //     const aTitle = a.title.toUpperCase();
        //     const bTitle = b.title.toUpperCase();
        //     if (aTitle !== bTitle) {
        //         return aTitle < bTitle ? -1 : 1;
        //     }
        //     else {
        //         const aJson = JSON.stringify(a);
        //         const bJson = JSON.stringify(b);
        //         if (aJson === bJson) {
        //             return 0;
        //         }
        //         return aJson < bJson ? -1 : 1;
        //     }
        // });
        console.log(JSON.stringify(builtSongs, null, 2));
    }
}