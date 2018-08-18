import express from 'express';
import http from 'http';
import socketio, { Socket } from 'socket.io';

const app = express();
app.use(express.static(__dirname));

const server = http.createServer(app);

const io = socketio(server);

let currentSongIds: number[] = [];
let lastSongLineAction: 'select' | 'unselect' | null = null;
let lastLineRef: any[] | null = null;

io.on('connection', client => {
    console.log(`client ${client.id} connected`);

    client.on('songs:ready', () => {
        console.log('received songs:ready');
        client.emit('songs:change', currentSongIds);
        sendSongLine();
    });
    client.on('songLine:ready', () => {
        console.log('received songLine:ready');
        sendSongLine();
    });
    function sendSongLine() {
        if (lastSongLineAction && lastLineRef) {
            console.log(`sending songLine:${lastSongLineAction}`, lastLineRef);
            client.emit(`songLine:${lastSongLineAction}`, ...lastLineRef);
        }
    }

    echoToAllClients(client, 'songs:change', ids => {
        currentSongIds = ids;
        lastSongLineAction = lastLineRef = null;
    });
    echoToAllClients(client, 'songLine:select', (...args: any[]) => {
        lastSongLineAction = 'select';
        lastLineRef = args;
    });
    echoToAllClients(client, 'songLine:unselect', (...args: any[]) => {
        lastSongLineAction = 'unselect';
        lastLineRef = args;
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

server.listen(8080);