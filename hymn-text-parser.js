const getDocxTextLines = require('./docxlines');

getDocxTextLines('data/#1-25.docx').then(lines => {
    // console.log(JSON.stringify(lines, null, 2));

    const songLocations = {
        before: 0,
        afterTitle: 1,
        afterScripture: 2,
        afterAuthor: 3,
        afterTune: 4,
        inStanzas: 5,
    };

    const songs = [];
    let currentSong = null;
    let currentStanza = null;
    let currentSongLocation = songLocations.before;

    lines.forEach((line, i) => {
        line = line.trimRight();
        if (currentSongLocation <= songLocations.before && line.length < 1) {
            return;
        }

        const startOfSongMatch = line.match(/^#(\d+) (.+)$/);
        if (currentSongLocation === songLocations.before || (startOfSongMatch && currentSongLocation >= songLocations.inStanzas)) {
            if (startOfSongMatch) {
                currentSong = {title: startOfSongMatch[2], majestyNumber: Number(startOfSongMatch[1])};
                currentStanza = null;
                currentSongLocation = songLocations.afterTitle;
                songs.push(currentSong);
            }
            else {
                throw `Expected line ${i} to be the title of a song, but found: ${line}`;
            }
        }

        else if (startOfSongMatch) {
            throw `Found line ${i} to unexpectedly be the title of a song: ${line}`;
        }

        else if (currentSongLocation === songLocations.afterTitle) {
            if (line.trim() === 'A faithful man shall abound with blessings. Proverbs 28:20') {
                line = 'A faithful man shall abound with blessings. -Proverbs 28:20';
            }
            const match = line.trim().match(/^(.+?) -(\w.+)$/);
            if (! match) {
                throw `Expected line ${i} to be the scripture quotation, but found: ${line}`;
            }
            currentSong.majestyScripture = {reference: match[2], text: match[1]};
            currentSongLocation = songLocations.afterScripture;
        }

        else if (currentSongLocation === songLocations.afterScripture) {
            const match = line.trim().match(/^By (.+?), (\d{4})\-(\d{4})?$/);
            if (! match) {
                throw `Expected line ${i} to be the author info, but found: ${line}`;
            }
            currentSong.author = {name: match[1], birthYear: Number(match[2]), deathYear: match[3] === undefined ? null : Number(match[3])};
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
                        throw `Expected line ${i} to be the tune, but found: ${line}`;
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
                const number = Number(match[1]);
                const restOfLine = match[2];
                if (currentStanza && currentStanza.majestyNumber + 1 !== number) {
                    throw `Expected line ${i} to be stanza #${currentStanza.majestyNumber + 1}, but found: ${line}`;
                }
                currentStanza = { majestyNumber: number, lines: [restOfLine] };
                if (! currentSong.stanzas) {
                    currentSong.stanzas = [];
                    currentSongLocation = songLocations.inStanzas;
                }
                currentSong.stanzas.push(currentStanza);
            }
            else {
                if (! currentStanza) {
                    throw `Expected line ${i} to be the beginning of a stanza, but found: ${line}`;
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

    songs.forEach(song => {
        song.stanzas.forEach(stanza => {
            const lines = stanza.lines;
            while (lines.length > 0 && lines[lines.length-1].length < 1) {
                lines.pop();
            }
        });
    });

    console.log(JSON.stringify(songs, null, 2));

});