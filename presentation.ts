import WordProjector from './word-projector';
import $ from 'jquery';
import screenfull from 'screenfull';

$(function() {
    const wordProjector = new WordProjector();
    const aspectRatio = wordProjector.aspectRatio;
    const $fullscreen = $('#makePresentationFullscreen');
    const $presentationFrame = $('#presentationFrame');
    const $presentationContents = $('#presentationContents');
    const $presentationBottomFade = $('#presentationBottomFade');

    wordProjector.$wordContents = $presentationContents;
    wordProjector.registerOnSongsChangeUpdateHtml($presentationContents);
    wordProjector.registerOnSongLineSelectHandleWhetherSwitchingArticle(isSwitchingArticle => {
        scrollToSelectedTopLine(!isSwitchingArticle);
    });
    wordProjector.registerOnSongLineUnselectSetTopLineAndClearSong(() => {
        scrollToSelectedTopLine(true);
    });


    $fullscreen.find('button').click(function() {
        $fullscreen.hide();
    });

    $fullscreen.find('button.makeFullscreen').click(function() {
        if (screenfull) screenfull.request();
    });


    function scrollToSelectedTopLine(doAnimateScroll = false) {
        const $topLine = $presentationContents.find('.' + wordProjector.topLineClass);
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
});