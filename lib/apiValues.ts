export type SongLineAction = 'select' | 'unselect' | null;

export default class Values {
    static readonly ccli = '/ccli';
    static readonly songsJson = '/songs.json';
    static readonly songs = 'songs';
    static readonly songLine = 'songLine';
    static readonly select = 'select';
    static readonly unselect = 'unselect';
    static readonly songs_ready = `${Values.songs}:ready`;
    static readonly songs_change = `${Values.songs}:change`;
    static readonly songLine_ready = `${Values.songLine}:ready`;
    static readonly songLine_select = `${Values.songLine}:${Values.select}`;
    static readonly songLine_unselect = `${Values.songLine}:${Values.unselect}`;
}