import express from 'express';
import http from 'http';
import socketio, { Socket } from 'socket.io';
import jsonfile from 'jsonfile';
import fs from 'fs';
import os from 'os';
import apiVals, { SongLineAction } from './apiValues';

const currentSongsPath = __dirname + '/data/currentSongs.json';
const ccliLicensePath = __dirname + '/data/ccli.json';

const app = express();

let ccliLicense: false | number = false;
try {
    const obj = jsonfile.readFileSync(ccliLicensePath);
    ccliLicense = typeof obj === 'number' && obj > 0 ? obj : false;
} catch (err) { 
    /* default to false if CCLI file doesn't exist with valid number */ 
}

app.get(apiVals.ccli, function (_req, res) {
    res.json(ccliLicense);
});
app.use('/data', express.static(__dirname + '/data'));
app.use(express.static(__dirname + '/dist'));

const server = http.createServer(app);

const io = socketio(server);

let songData: SongData = {
    songIds: [],
    songLineAction: null,
    songLineRef: null
}

io.on('connection', client => {
    console.log(`client ${client.id} connected`);

    client.on(apiVals.songs_ready, () => {
        console.log(`received ${apiVals.songs_ready}`);
        client.emit(apiVals.songs_change, songData.songIds);
        sendSongLine();
    });
    client.on(apiVals.songLine_ready, () => {
        console.log('received ' + apiVals.songLine_ready);
        sendSongLine();
    });
    function sendSongLine() {
        if (songData.songLineAction && songData.songLineRef) {
            console.log(`sending ${apiVals.songLine}:${songData.songLineAction}`, songData.songLineRef);
            client.emit(`${apiVals.songLine}:${songData.songLineAction}`, ...songData.songLineRef);
        }
    }

    client.on(apiVals.songs_change, (songIds: number[]) => {
        console.log(`echo ${apiVals.songs_change}`, songIds);
        io.emit(apiVals.songs_change, songIds);
        songData.songIds = songIds;
        songData.songLineAction = songData.songLineRef = null;
        persistSongData();
    });

    [apiVals.select, apiVals.unselect].forEach(action => {
        const event = `${apiVals.songLine}:${action}`;
        client.on(event, (song: number, stanza: number, line: number) => {
            console.log(`echo ${event}`, { song, stanza, line });
            io.emit(event, song, stanza, line);
            songData.songLineAction = action as any;
            songData.songLineRef = [song, stanza, line];
            persistSongData();
        });
    });

    client.on('disconnect', reason => console.log(`client ${client.id} disconnected: ${reason}`));
});

function persistSongData() {
    jsonfile.writeFile(currentSongsPath, songData);
}

interface SongData {
    songIds: number[];
    songLineAction: SongLineAction;
    songLineRef: [number, number, number] | null;
}

if (fs.existsSync(currentSongsPath)) {
    const { songIds, songLineAction, songLineRef } = jsonfile.readFileSync(currentSongsPath);

    const validSongIds = Array.isArray(songIds) && songIds.every(val => typeof val === 'number');
    const validLineAction = songLineAction === apiVals.select || songLineAction === apiVals.unselect || songLineAction === null;
    const validLineRef = songLineRef === null || Array.isArray(songLineRef);

    if (validSongIds && validLineAction && validLineRef) {
        songData = { songIds, songLineAction, songLineRef, };
    }
}

const port = 8080;
server.listen(port, () => {
    const addresses: string[] = [];
    Object.values(os.networkInterfaces()).forEach(interfaces => {
        interfaces
            .filter(iface => iface.family === 'IPv4' && iface.internal === false)
            .forEach(iface => addresses.push(`http://${iface.address}:${port}`))
    })

    console.log(`Listening on ${addresses.join('\n             ')}\n`);
});