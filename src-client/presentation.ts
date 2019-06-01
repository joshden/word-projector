import WordProjector from './word-projector';
import $ from 'jquery';
import screenfull from 'screenfull';

import 'purecss/build/pure-min.css';
import 'purecss/build/grids-responsive-min.css';
import './presentation.css';

const wordProjector = new WordProjector();
const aspectRatio = wordProjector.aspectRatio;
const $fullscreen = $('#makePresentationFullscreen');
const $presentationFrame = $('#presentationFrame');
const $presentationContents = $('#presentationContents');
const $presentationBottomFade = $('#presentationBottomFade');

wordProjector.$wordContents = $presentationContents;
wordProjector.registerOnSongsChangeUpdateHtml($presentationContents, $songLines => {
    window.close();
    const linesAndWrapWords: number[][] = [];
    $songLines.each(function (iLine) {
        // console.log($(this).text().includes('N<o>w Thank We All Our\u00A0God #499'));
        const $line = $(this);
        const lineText = $line.text();
        $line.text('');
        const lineWords = lineText.split(' ');
        let previousHeight = 0;
        let buildingLine = '';
        const iWrapWords: number[] = [];
        lineWords.forEach((word, iWord) => {
            $line.text(buildingLine + ' ' + word);
            const newHeight = $line.height() as number;
            if (previousHeight > 0 && newHeight > previousHeight) {
                iWrapWords.push(iWord/*, word*/);
            }
            buildingLine += ' ' + word;
            previousHeight = newHeight;
        });
        if (iWrapWords.length > 0) {
            linesAndWrapWords.push([iLine].concat(iWrapWords));
        }
    });
    console.log(JSON.stringify(linesAndWrapWords));
    sessionStorage.setItem("linesAndWrapWords", JSON.stringify({ time: new Date().getTime(), data: linesAndWrapWords }));
});
wordProjector.registerOnSongLineSelectHandleWhetherSwitchingArticle(isSwitchingArticle => {
    scrollToSelectedTopLine(!isSwitchingArticle);
});
wordProjector.registerOnSongLineUnselectSetTopLineAndClearSong(() => {
    scrollToSelectedTopLine(true);
});


$fullscreen.find('button').click(function () {
    $fullscreen.hide();
});

$fullscreen.find('button.makeFullscreen').click(function () {
    if (screenfull) screenfull.request();
});


function scrollToSelectedTopLine(doAnimateScroll = false) {
    const $topLine = $presentationContents.find('.' + wordProjector.topLineClassName);
    const presentationScrolledAmount = $topLine.length ? (-($presentationContents.offset() as JQuery.Coordinates).top + ($topLine.offset() as JQuery.Coordinates).top) : 0;

    if (doAnimateScroll) {
        $presentationContents.addClass('animate-scroll');
    }
    else {
        $presentationContents.removeClass('animate-scroll');
    }
    $presentationContents.css('transform', `translateY(${-presentationScrolledAmount}px)`);
}

function handlePresentationWindowResize() {
    const clientWidth = (document.documentElement as HTMLElement).clientWidth;
    const clientHeight = (document.documentElement as HTMLElement).clientHeight;

    if (clientWidth > clientHeight * aspectRatio) {
        const scaledFrameWidth = clientHeight * aspectRatio;
        $presentationFrame.css('width', scaledFrameWidth + 'px');
        $presentationFrame.css('height', clientHeight + 'px');
        $presentationContents.add($presentationBottomFade).css('font-size', (scaledFrameWidth / clientWidth) + 'em');
    }

    else {
        $presentationFrame.css('width', '');
        $presentationFrame.css('height', (clientWidth / aspectRatio) + 'px');
        $presentationContents.add($presentationBottomFade).css('font-size', '');
    }

    scrollToSelectedTopLine(false);
}

handlePresentationWindowResize();
$(window).resize(handlePresentationWindowResize);