import express from 'express';
import http from 'http';
import socketio from 'socket.io';
import jsonfile from 'jsonfile';
import fs from 'fs';
import os from 'os';
import apiVals, { SongLineAction } from './lib/apiValues';
import Song from './lib/song';
import _ from 'lodash';
import { LocalDateTime } from 'js-joda';
import path from 'path';
import { promisify } from 'util';

const dataDir = path.resolve(__dirname, 'data');
const songsPath = path.resolve(dataDir, 'songs.json');
const songsShownLogPath = path.resolve(dataDir, 'songsShown.log');
const currentSongsPath = path.resolve(dataDir, 'currentSongs.json');
const ccliLicensePath = path.resolve(dataDir, 'ccli.json');

const readJsonFile = promisify(jsonfile.readFile);
const writeJsonFile = promisify(jsonfile.writeFile);

(async function() {
    const [allSongs, ccliLicense, currentSongs] = await Promise.all([
        getAllSongs(),
        getCcliLicense(),
        getPersistedCurrentSongs()
    ]);

    const app = getExpressRoutes(ccliLicense, allSongs);
    const server = http.createServer(app);

    setupSocketIoHandlers(socketio(server), currentSongs, allSongs);
    startServer(server);

})().catch(e => logError('ERROR', e));

async function getAllSongs() {
    return await (readJsonFile(songsPath)) as Song[];
}

async function getCcliLicense() {
    const ccliObj = await readJsonFile(ccliLicensePath);
    const ccliLicense = typeof ccliObj === 'number' && ccliObj > 0 ? ccliObj : false;
    return ccliLicense;
}

async function getPersistedCurrentSongs(): Promise<CurrentSongs> {
    if (await promisify(fs.exists)(currentSongsPath)) {
        const { songIds, songLineAction, songLineRef } = await readJsonFile(currentSongsPath);

        const validSongIds = Array.isArray(songIds) && songIds.every(val => typeof val === 'number');
        const validLineAction = songLineAction === apiVals.select || songLineAction === apiVals.unselect || songLineAction === null;
        const validLineRef = songLineRef === null || Array.isArray(songLineRef);

        if (validSongIds && validLineAction && validLineRef) {
            return { songIds, songLineAction, songLineRef, };
        }
    }

    return {
        songIds: [],
        songLineAction: null,
        songLineRef: null
    };
}

function getExpressRoutes(ccliLicense: number | boolean, allSongs: Song[]) {
    const app = express();
    app.get(apiVals.ccli, function (_req, res) {
        res.json(ccliLicense);
    });
    app.get(apiVals.songsJson, function (_req, res) {
        res.json(allSongs);
    });
    app.use('/data', express.static(__dirname + '/data'));
    app.use(express.static(__dirname + '/dist'));
    return app;
}

function setupSocketIoHandlers(io: socketio.Server, currentSongs: CurrentSongs, allSongs: Song[]) {
    io.on('connection', client => {
        console.log(`client ${client.id} connected`);

        client.on(apiVals.songs_ready, () => {
            console.log(`received ${apiVals.songs_ready}`);
            client.emit(apiVals.songs_change, currentSongs.songIds);
            sendSongLine();
        });

        client.on(apiVals.songLine_ready, () => {
            console.log('received ' + apiVals.songLine_ready);
            sendSongLine();
        });

        function sendSongLine() {
            if (currentSongs.songLineAction && currentSongs.songLineRef) {
                console.log(`sending ${apiVals.songLine}:${currentSongs.songLineAction}`, currentSongs.songLineRef);
                client.emit(`${apiVals.songLine}:${currentSongs.songLineAction}`, ...currentSongs.songLineRef);
            }
        }

        client.on(apiVals.songs_change, (songIds: number[]) => {
            console.log(`echo ${apiVals.songs_change}`, songIds);
            io.emit(apiVals.songs_change, songIds);
            currentSongs.songIds = songIds;
            currentSongs.songLineAction = currentSongs.songLineRef = null;
            persistCurrentSongs(currentSongs);
        });

        ([apiVals.select, apiVals.unselect] as SongLineAction[]).forEach(action => {
            const event = `${apiVals.songLine}:${action}`;
            client.on(event, (song: number, stanza: number, line: number) => {
                console.log(`echo ${event}`, { song, stanza, line });
                io.emit(event, song, stanza, line);
                currentSongs.songLineAction = action;
                currentSongs.songLineRef = [song, stanza, line];
                if (action === 'select') {
                    logSongShown(allSongs, currentSongs.songIds[song]);
                }
                persistCurrentSongs(currentSongs);
            });
        });
        
        client.on('disconnect', reason => console.log(`client ${client.id} disconnected: ${reason}`));
    });
}

function startServer(server: http.Server) {
    const port = 8080;
    server.listen(port, () => {
        const addresses: string[] = [];
        Object.values(os.networkInterfaces()).forEach(interfaces => {
            interfaces
                .filter(iface => iface.family === 'IPv4' && iface.internal === false)
                .forEach(iface => addresses.push(`http://${iface.address}:${port}`));
        });
        console.log(`Listening on ${addresses.join('\n             ')}\n`);
    });
}

function persistCurrentSongs(currentSongs: CurrentSongs) {
    writeJsonFile(currentSongsPath, currentSongs).catch(err => logError('Error persisting song data', err));
}

const loggedSongIds = new Set<number>();
function logSongShown(allSongs: Song[], songId: number) {
    if (!loggedSongIds.has(songId)) {
        loggedSongIds.add(songId);
        const { title, ccliSongNumber, majestyNumber, stanzas, author, copyright } = allSongs[songId - 1];
        const logEntry = JSON.stringify({
            dateTime: LocalDateTime.now().toString(),
            majestyNumber,
            scripture: (author as any).scriptureRef,
            title,
            ccliSongNumber,
            copyright,
            firstLine: _.get(stanzas, '[0]', { lines: [] }).lines[0]
        });
        console.log('logging song shown', logEntry);
        promisify(fs.writeFile)(songsShownLogPath, logEntry + '\n', { flag: 'a' }).catch(err => logError('Error logging song shown', err));
    }
}

function logError(message: string, error: any) {
    console.error(message, error);
}

interface CurrentSongs {
    songIds: number[];
    songLineAction: SongLineAction;
    songLineRef: [number, number, number] | null;
}