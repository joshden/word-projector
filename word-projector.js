class WordProjector {
    constructor() {
        const widthByHeight = [16, 9];
        this.aspectRatio = widthByHeight[0] / widthByHeight[1];
        this.$wordContents = null;

        this.ccliLicense = false;

        this.allSongs = [];
        this.currentSongs = [];
        this.currentSongLineAction = null;
        this.currentSong = null;
        this.currentStanza = null;
        this.currentLine = null;

        this.onSongsLoadedCallbacks = [];
        this.onSongsChangeCallbacks = [];
        this.onSongLineSelectCallbacks = [];
        this.onSongLineUnselectCallbacks = [];

        this.socket = io({ transports: ['polling'] });
        this.socket.on('songs:change', ids => {
            this.currentSongs = ids.map(id =>
                this.allSongs.find(song =>
                    song.id === id));
            this.currentSongLineAction = this.currentSong = this.currentStanza = this.currentLine = null;
            this.onSongsChangeCallbacks.forEach(callback => callback(this.currentSongs));
        });
        this.socket.on('songLine:select', (song, stanza, line) => {
            this.currentSong = song;
            this.currentStanza = stanza;
            this.currentLine = line;
            this.currentSongLineAction = 'select';
            this.onSongLineSelectCallbacks.forEach(callback => callback(song, stanza, line));
        });
        this.socket.on('songLine:unselect', (song, stanza, line) => {
            this.currentSong = song;
            this.currentStanza = stanza;
            this.currentLine = line;
            this.currentSongLineAction = 'unselect';
            this.onSongLineUnselectCallbacks.forEach(callback => callback(song, stanza, line));
        });

        const ccliPromise = $.get('/ccli', ccliLicense => this.ccliLicense = ccliLicense);
        const songsPromise = $.get('data/songs.json', songs => {
            let id = 0;
            songs.forEach(song => song.id = ++id);
            this.allSongs = songs;
            this.onSongsLoadedCallbacks.forEach(callback => callback(songs));
        });

        $.when(ccliPromise, songsPromise).then(() => {
            this.socket.on('reconnect', () => {
                this.socket.emit('songs:ready');
            });
            this.socket.emit('songs:ready');
        });
    }

    changeSongs(songIds) {
        this.socket.emit('songs:change', songIds);
    }

    selectSongLine(song, stanza, line) {
        this.socket.emit(`songLine:select`, song, stanza, line);
    }
    
    unselectSongLine(song, stanza, line) {
        this.socket.emit(`songLine:unselect`, song, stanza, line);
    }

    get activeClass() {
        return 'active';
    }
    get activeArticle() {
        return 'article.' + this.activeClass;
    }
    get topLineClass() {
        return 'top-line';
    }

    getSongsHtml(songs) {
        const ccliLicense = this.ccliLicense;
        function hymnalNumber(song) {
            return song.majestyNumber ? ` #${song.majestyNumber.toFixed()}` : '';
        }
        function authorText(song) {
            const author = song.author;
            if (author.hasOwnProperty('scriptureRef')) {
                return `From ${author.scriptureRef}`;
            }
            else if (author.hasOwnProperty('name')) {
                return `By ${author.name}`;
            }
            else if (author.hasOwnProperty('basedOn')) {
                return `Based on ${author.basedOn}`;
            }
            else if (author.hasOwnProperty('source')) {
                return author.source;
            }
            else if (author.hasOwnProperty('scripture')) {
                return author.scripture;
            }
            else if (author.hasOwnProperty('byWork')) {
                return author.byWork;
            }
            else if (author.traditional) {
                return 'Traditional'
            }
            else if (typeof author === 'string') {
                return author;
            }
            return '';
        }
        function fullAuthorText(song) {
            let fullText = authorText(song);
            const props = ['arrangedBy', 'adaptedBy', 'translatedBy', 'versifiedBy'];
            Object.getOwnPropertyNames(song).filter(prop => props.includes(prop)).forEach(propName => {
                if (fullText) {
                    fullText += '; ';
                }
                fullText += propName.substr(0, propName.length-2) + ' by ' + song[propName].name;
            });
            return fullText
        }
        function stanzasAndFooter(song) {
            const canShowWords = ! song.copyright || (ccliLicense && song.ccliSongNumber && song.ccliWordsCopyrights);
            return ! canShowWords ? '<footer><h1>(Words only in hymnal)</h1></footer>' : `
                ${song.stanzas.map(stanza => stanza.lines).map(lines => `
                <ol>${lines.map(line => `
                    <li>${escape(line)}</li>`).join('')}
                </ol>`).join('\n')
                }

                <footer>
                    <h1>${escape(song.title)}</h1>
                    <h2>${escape(fullAuthorText(song))}</h2>${song.ccliWordsCopyrights && song.ccliWordsCopyrights !== 'Public Domain' ? `
                    <h3>© ${escape(song.ccliWordsCopyrights)}</h3>
                    <h3>CCLI License # ${ccliLicense}</h3>` : ''}
                </footer>
            `;
        }
        function escape(text) {
            const escaped = _.escape(text);
            
            const matched = escaped.match(/( +)([^ ]+)$/);
            if (matched) {
                const beforeLastSpaces = escaped.substr(0, escaped.length - matched[0].length);
                const nbspLastSpaces = matched[1].replace(/ /g, '&nbsp;');
                const afterLastSpaces = matched[2];
                return beforeLastSpaces + nbspLastSpaces + afterLastSpaces;
            }
            else {
                return escaped;
            }
        }
        const songsHtml = songs.map(song => `
            <article>
                <header>
                    <h1>${escape(song.title)}${hymnalNumber(song)}</h1>
                    <h2>${escape(authorText(song))}</h2>
                </header>
                ${stanzasAndFooter(song)}
            </article>
        `).join('');

        return songsHtml;
    }

    unselectSong() {
        this.$wordContents.find(this.activeArticle).removeClass(this.activeClass);
    }

    setTopLine(song, stanza, line) {
        this.setTopLineAndGetSelectionInfo(song, stanza, line);
    }

    setTopLineAndGetSelectionInfo(song, stanza, line) {
        const articleSelector = `article:nth-of-type(${song + 1})`;
        const isSwitchingArticle = $(articleSelector).get(0) !== $(this.activeArticle).get(0);
        const scrollToSelector = articleSelector + ` > :nth-child(${stanza + 1}) > :nth-child(${line + 1})`;
        this.$wordContents.find('.' + this.topLineClass).removeClass(this.topLineClass);
        this.$wordContents.find(scrollToSelector).addClass(this.topLineClass);
        return { articleSelector, isSwitchingArticle };
    }

    registerOnSongsLoaded(callback) {
        this.onSongsLoadedCallbacks.push(callback);
        callback(this.allSongs);
    }

    registerOnSongsChange(callback) {
        this.onSongsChangeCallbacks.push(callback);
        callback(this.currentSongs);
    }

    registerOnSongsChangeUpdateHtml($contents, callback) {
        this.registerOnSongsChange(songs => {
            const songsHtml = this.getSongsHtml(songs);
            $contents.html(songsHtml);
            if (callback) {
                callback();
            }
        });
    }

    registerOnSongLineSelect(callback) {
        this.onSongLineSelectCallbacks.push(callback);
        if (this.currentSongLineAction === 'select') {
            callback(this.currentSong, this.currentStanza, this.currentLine);
        }
    }

    registerOnSongLineSelectHandleWhetherSwitchingArticle(callback) {
        this.registerOnSongLineSelect((song, stanza, line) => {
            const { articleSelector, isSwitchingArticle } = this.setTopLineAndGetSelectionInfo(song, stanza, line);
            if (isSwitchingArticle) {
                this.unselectSong();
                this.$wordContents.find(articleSelector).addClass('active');
            }
            callback(isSwitchingArticle);
        });
    }

    registerOnSongLineUnselect(callback) {
        this.onSongLineUnselectCallbacks.push(callback);
        if (this.currentSongLineAction === 'unselect') {
            callback(this.currentSong, this.currentStanza, this.currentLine);
        }
    }

    registerOnSongLineUnselectSetTopLineAndClearSong(callback) {
        this.registerOnSongLineUnselect((song, stanza, line) => {
            this.setTopLine(song, stanza, line);
            this.unselectSong();
            callback();
        });
    }
}