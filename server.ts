import express from 'express';
import http from 'http';
import socketio, { Socket } from 'socket.io';
import jsonfile from 'jsonfile';
import fs from 'fs';
import os from 'os';

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

app.get('/ccli', function (req, res) {
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

    client.on('songs:ready', () => {
        console.log('received songs:ready');
        client.emit('songs:change', songData.songIds);
        sendSongLine();
    });
    client.on('songLine:ready', () => {
        console.log('received songLine:ready');
        sendSongLine();
    });
    function sendSongLine() {
        if (songData.songLineAction && songData.songLineRef) {
            console.log(`sending songLine:${songData.songLineAction}`, songData.songLineRef);
            client.emit(`songLine:${songData.songLineAction}`, ...songData.songLineRef);
        }
    }

    echoToAllClients(client, 'songs:change', ids => {
        songData.songIds = ids;
        songData.songLineAction = songData.songLineRef = null;
        persistSongData();
    });
    echoToAllClients(client, 'songLine:select', (...args: any[]) => {
        songData.songLineAction = 'select';
        songData.songLineRef = args;
        persistSongData();
    });
    echoToAllClients(client, 'songLine:unselect', (...args: any[]) => {
        songData.songLineAction = 'unselect';
        songData.songLineRef = args;
        persistSongData();
    });

    client.on('disconnect', reason => console.log(`client ${client.id} disconnected: ${reason}`));
});

function echoToAllClients(client: Socket, event: string, callback?: (...args: any[]) => void) {
    client.on(event, (...args: any[]) => {
        console.log(`echo ${event}`, ...args);
        io.emit(event, ...args);
        if (callback) {
            callback(...args);
        }
    });
}

function persistSongData() {
    jsonfile.writeFile(currentSongsPath, songData);
}

interface SongData {
    songIds: number[];
    songLineAction: 'select' | 'unselect' | null;
    songLineRef: any[] | null;
}

if (fs.existsSync(currentSongsPath)) {
    const { songIds, songLineAction, songLineRef } = jsonfile.readFileSync(currentSongsPath);

    const validSongIds = Array.isArray(songIds) && songIds.every(val => typeof val === 'number');
    const validLineAction = songLineAction === 'select' || songLineAction === 'unselect' || songLineAction === null;
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