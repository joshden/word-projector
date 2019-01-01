import $ from 'jquery';
import io from 'socket.io-client';
import _ from 'lodash';

import 'purecss/build/pure-min.css';
import 'purecss/build/grids-responsive-min.css';
import 'selectize/dist/css/selectize.default.css';

const socket = io({ transports: ['polling'] });

const $histogram = $('#histogram');
const $button = $('button');
const maxBinCount = 16;
let total = 0;
let count = 0;
let min = 5000;
let max = 0;
let startTime = new Date();
const entries: number[] = [];
let stopTest = true;

$.get('data/songs.json', allSongs => {
    const randomIds = _.times(3, () => Math.floor(Math.random() * allSongs.length));
    socket.on('songs:change', (ids: number[]) => {
        if (!stopTest && _.isEqual(ids, randomIds)) {
            const millis = new Date().getTime() - startTime.getTime();
            total += millis;
            count++;
            min = Math.min(millis, min);
            max = Math.max(millis, max);
            entries.push(millis);
            const binCount = Math.min(entries.length, maxBinCount);
            const binSize = max / binCount;
            const bins: number[] = [];
            for (let i = 0; i < binCount; i++) {
                bins[i] = 0;
            }
            entries.forEach(millis => {
                const bin = Math.min(Math.floor(millis / binSize), binCount - 1);
                bins[bin]++;
            });
            const maxCount = Math.max(...bins);

            $('#average').text(Math.round(total / count));
            $('#min').text(min);
            $('#max').text(max);
            $histogram.empty();
            bins.forEach((count, i) => {
                $histogram.append(`<li style="width:${count / maxCount * 100}%">${Math.floor(i * binSize)}-${Math.floor((i + 1) * binSize)} (${count})</li>`);
            });
            setTimeout(runTest, 2000);
        }
    });

    function runTest() {
        startTime = new Date();
        socket.emit('songs:change', randomIds);
    }

    const start = 'Start ▶️';
    $button.text(start).click(() => {
        if ($button.text() === start) {
            $button.text('Pause ⏸️');
            stopTest = false;
            runTest();
        }
        else {
            $button.text(start);
            stopTest = true;
        }
    });
});