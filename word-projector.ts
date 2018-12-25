import $ from 'jquery';
import io from 'socket.io-client';
import _ from 'lodash';
import Song from './song';
import apiVal, { SongLineAction } from './apiValues';

export default class WordProjector {
    readonly aspectRatio: number;
    $wordContents = $();
    ccliLicense: number | false = false;
    allSongs: Song[] = [];

    currentSongs: Song[] = [];
    currentSongLineAction : SongLineAction = null;
    currentSongStanzaLine: null | {
        song: number,
        stanza: number,
        line: number
    } = null;

    onSongsLoadedCallbacks: SongsCallback[] = [];
    onSongsChangeCallbacks: SongsCallback[] = [];
    onSongLineSelectCallbacks: SongStanzaLineCallback[] = [];
    onSongLineUnselectCallbacks: SongStanzaLineCallback[] = [];

    socket = io({ transports: ['polling'] });

    constructor() {
        const widthByHeight = [16, 9];
        this.aspectRatio = widthByHeight[0] / widthByHeight[1];

        this.socket = io({ transports: ['polling'] });
        this.socket.on(apiVal.songs_change, (ids: number[]) => {
            this.currentSongs = [];
            ids
                .map(id => this.allSongs.find(song => song.id === id))
                .forEach(song => {
                    if (song !== undefined) {
                        this.currentSongs.push(song);
                    }
                });
            this.currentSongLineAction = this.currentSongStanzaLine = null;
            this.onSongsChangeCallbacks.forEach(callback => callback(this.currentSongs));
        });
        this.socket.on(apiVal.songLine_select, (song: number, stanza: number, line: number) => {
            this.currentSongStanzaLine = { song, stanza, line };
            this.currentSongLineAction = apiVal.select;
            this.onSongLineSelectCallbacks.forEach(callback => callback(song, stanza, line));
        });
        this.socket.on(apiVal.songLine_unselect, (song: number, stanza: number, line: number) => {
            this.currentSongStanzaLine = { song, stanza, line };
            this.currentSongLineAction = apiVal.unselect;
            this.onSongLineUnselectCallbacks.forEach(callback => callback(song, stanza, line));
        });

        const ccliPromise = $.get(apiVal.ccli, ccliLicense => this.ccliLicense = ccliLicense);
        const songsPromise = $.get('data/songs.json', (songs: Song[]) => {
            let id = 0;
            songs.forEach(song => song.id = ++id);
            this.allSongs = songs;
            this.onSongsLoadedCallbacks.forEach(callback => callback(songs));
        });

        $.when(ccliPromise, songsPromise).then(() => {
            this.socket.on('reconnect', () => {
                this.socket.emit(apiVal.songs_ready);
            });
            this.socket.emit(apiVal.songs_ready);
        });
    }

    changeSongs(songIds: number[]) {
        this.socket.emit(apiVal.songs_change, songIds);
    }

    selectSongLine(song: number, stanza: number, line: number) {
        this.socket.emit(apiVal.songLine_select, song, stanza, line);
    }
    
    unselectSongLine(song: number, stanza: number, line: number) {
        this.socket.emit(apiVal.songLine_unselect, song, stanza, line);
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

    getSongsHtml(songs: Song[]) {
        const ccliLicense = this.ccliLicense;
        function hymnalNumber(song: Song) {
            return song.majestyNumber ? ` #${song.majestyNumber.toFixed()}` : '';
        }
        function authorText(song: Song) {
            const authors = [song.author].concat(song.otherAuthors ? song.otherAuthors : []);
            const prefixAuthors = authors.map((author: any) => {
                if (author.hasOwnProperty('scriptureRef')) {
                    return ['From', author.scriptureRef];
                }
                else if (author.hasOwnProperty('name')) {
                    return ['By', author.name];
                }
                else if (author.hasOwnProperty('basedOn')) {
                    return ['Based on', author.basedOn];
                }
                else if (author.hasOwnProperty('source')) {
                    return ['', author.source];
                }
                else if (author.hasOwnProperty('scripture')) {
                    return ['', author.scripture];
                }
                else if (author.hasOwnProperty('byWork')) {
                    return ['', author.byWork];
                }
                else if (author.traditional) {
                    return ['', 'Traditional'];
                }
                else if (typeof author === 'string') {
                    return ['', author];
                }
                throw new Error(`Unexpected author info: ${JSON.stringify(author)}`);
            }).filter(v => v !== undefined);
            let authorText = '';
            let previousPrefix = '';
            prefixAuthors.forEach(prefixAuthor => {
                const [prefix, author] = prefixAuthor;
                if (prefix === previousPrefix) {
                    authorText += ((authorText.length > 0) ? ', ' : '') + author;
                }
                else {
                    authorText += ((authorText.length > 0) ? '; ' : '') + prefix + ' ' + author;
                }
                previousPrefix = prefix;
            });
            return authorText;
        }
        function fullAuthorText(song: Song) {
            let fullText = authorText(song);
            const props = ['arrangedBy', 'adaptedBy', 'translatedBy', 'versifiedBy'];
            Object.getOwnPropertyNames(song).filter(prop => props.includes(prop)).forEach(propName => {
                if (fullText) {
                    fullText += '; ';
                }
                fullText += propName.substr(0, propName.length-2) + ' by ' + (song as any)[propName].name;
            });
            return fullText;
        }
        function stanzasAndFooter(song: Song) {
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
        function escape(text: string) {
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

    setTopLine(song: number, stanza: number, line: number) {
        this.setTopLineAndGetSelectionInfo(song, stanza, line);
    }

    setTopLineAndGetSelectionInfo(song: number, stanza: number, line: number) {
        const articleSelector = `article:nth-of-type(${song + 1})`;
        const isSwitchingArticle = $(articleSelector).get(0) !== $(this.activeArticle).get(0);
        const scrollToSelector = articleSelector + ` > :nth-child(${stanza + 1}) > :nth-child(${line + 1})`;
        this.$wordContents.find('.' + this.topLineClass).removeClass(this.topLineClass);
        this.$wordContents.find(scrollToSelector).addClass(this.topLineClass);
        return { articleSelector, isSwitchingArticle };
    }

    registerOnSongsLoaded(callback: (songs: Song[]) => void) {
        this.onSongsLoadedCallbacks.push(callback);
        callback(this.allSongs);
    }

    registerOnSongsChange(callback: (songs: Song[]) => void) {
        this.onSongsChangeCallbacks.push(callback);
        callback(this.currentSongs);
    }

    registerOnSongsChangeUpdateHtml($contents: JQuery, callback?: () => void) {
        this.registerOnSongsChange(songs => {
            const songsHtml = this.getSongsHtml(songs);
            $contents.html(songsHtml);
            if (callback) {
                callback();
            }
        });
    }

    registerOnSongLineSelect(callback: SongStanzaLineCallback) {
        this.onSongLineSelectCallbacks.push(callback);
        if (this.currentSongLineAction === apiVal.select) {
            if (this.currentSongStanzaLine === null) {
                throw new Error('registerOnSongLineSelect: this.currentSongStanzaLine unexpectedly null');
            }
            const { song, stanza, line } = this.currentSongStanzaLine;
            callback(song, stanza, line);
        }
    }

    registerOnSongLineSelectHandleWhetherSwitchingArticle(callback: (isSwitchingArticle: boolean) => void) {
        this.registerOnSongLineSelect((song: number, stanza: number, line: number) => {
            const { articleSelector, isSwitchingArticle } = this.setTopLineAndGetSelectionInfo(song, stanza, line);
            if (isSwitchingArticle) {
                this.unselectSong();
                this.$wordContents.find(articleSelector).addClass('active');
            }
            callback(isSwitchingArticle);
        });
    }

    registerOnSongLineUnselect(callback: SongStanzaLineCallback) {
        this.onSongLineUnselectCallbacks.push(callback);
        if (this.currentSongLineAction === apiVal.unselect) {
            if (this.currentSongStanzaLine === null) {
                throw new Error('registerOnSongLineUnselect: this.currentSongStanzaLine unexpectedly null');
            }
            const { song, stanza, line } = this.currentSongStanzaLine;
            callback(song, stanza, line);
        }
    }

    registerOnSongLineUnselectSetTopLineAndClearSong(callback: Function) {
        this.registerOnSongLineUnselect((song: number, stanza: number, line: number) => {
            this.setTopLine(song, stanza, line);
            this.unselectSong();
            callback();
        });
    }
}

type SongsCallback = (songs: Song[]) => void;
type SongStanzaLineCallback = (song: number, stanza: number, line: number) => void;