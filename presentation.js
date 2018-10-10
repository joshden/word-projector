$(function() {
    const wordProjector = new WordProjector();
    const aspectRatio = wordProjector.aspectRatio;
    const $fullscreen = $('#makePresentationFullscreen');
    const $presentationFrame = $('#presentationFrame');
    const $presentationContents = $('#presentationContents');
    const $presentationBottomFade = $('#presentationBottomFade');

    let presentationScrolledAmount = 0;

    wordProjector.$wordContents = $presentationContents;
    wordProjector.registerOnSongsChangeUpdateHtml($presentationContents);
    wordProjector.registerOnSongLineSelectHandleWhetherSwitchingArticle(isSwitchingArticle => {
        selectLineAndAnimate(!isSwitchingArticle);
    });
    wordProjector.registerOnSongLineUnselectSetTopLineAndClearSong(() => {
        selectLineAndAnimate(true);
    });


    $fullscreen.find('button').click(function() {
        $fullscreen.hide();
    });

    $fullscreen.find('button.makeFullscreen').click(function() {
        screenfull.request();
    });


    function selectLineAndAnimate(doAnimateScroll) {
        $presentationContents.stop(true);
        updatePresentationScrolledAmount();
        // if (doAnimateScroll) {
        //     $presentationContents.animate({
        //         marginTop: -presentationScrolledAmount
        //     }, 1000);
        // }
        // else {
            $presentationContents.css('transform', `translateY(${-presentationScrolledAmount}px)`);
        // }
    }

    function handlePresentationWindowResize() {
        const clientWidth = document.documentElement.clientWidth;
        const clientHeight = document.documentElement.clientHeight;

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

        updatePresentationScrolledAmount();
        $presentationContents.css('transform', `translateY(${-presentationScrolledAmount}px)`);
    }
    handlePresentationWindowResize();
    $(window).resize(handlePresentationWindowResize);

    function updatePresentationScrolledAmount() {
        const $topLine = $presentationContents.find('.' + wordProjector.topLineClass);
        if ($topLine.length) {
            presentationScrolledAmount = -$presentationContents.offset().top + $topLine.offset().top;
        }
        else {
            presentationScrolledAmount = 0;
        }
    }
});