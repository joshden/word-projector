$(function () {
    const aspectRatio = wordProjector.aspectRatio;
    const $launchPresentation = $('#launchPresentation');
    const $liveFrame = $('#liveFrame');
    const $presenterFrame = $('#presenterFrame');
    const $presenterContents = $('#presenterContents');
    const topLineClass = wordProjector.topLineClass;
    const activeArticleSelector = wordProjector.activeArticle;

    let popup = null;

    wordProjector.$wordContents = $presenterContents;
    wordProjector.registerOnSongsChangeUpdateHtml($presenterContents, () => {
        setLiveFramePosition();

        $presenterContents.find('article h1, article h2, article h3, article li').click(function () {
            const $clickedLine = $(this);
            const $article = $clickedLine.parents('article').first();

            const song = $article.prevAll('article').length;
            const stanza = $clickedLine.parent().prevAll().length;
            const line = $clickedLine.prevAll().length;
            const shouldUnselect = $clickedLine.hasClass(topLineClass) && $article.get(0) === $(activeArticleSelector).get(0);

            if (shouldUnselect) {
                wordProjector.unselectSongLine(song, stanza, line);
            }
            else {
                wordProjector.selectSongLine(song, stanza, line);
            }
        });
    });
    wordProjector.registerOnSongLineSelectHandleWhetherSwitchingArticle(() => {
        setLiveFramePosition();
    });
    wordProjector.registerOnSongLineUnselectSetTopLineAndClearSong(() => {
        setLiveFramePosition();
    });


    $(window).resize(setPresenterFontSizeAndLiveFramePosition);

    function setPresenterFontSizeAndLiveFramePosition() {
        const windowWidth = window.innerWidth;
        const presenterWidth = $presenterFrame.width();

        $presenterContents.css('font-size', (presenterWidth / windowWidth) + 'em');

        setLiveFramePosition();
    }

    function setLiveFramePosition() {
        const presenterWidth = $presenterFrame.width();

        const $topLine = $('.' + topLineClass);
        if ($topLine.length) {
            const liveFrameHeight = presenterWidth / aspectRatio;
            $liveFrame.css('height', String(liveFrameHeight - borderWidth($liveFrame, 'Top') - borderWidth($liveFrame, 'Bottom')) + 'px');
            $liveFrame.css('width', String(presenterWidth - borderWidth($liveFrame, 'Left') - borderWidth($liveFrame, 'Left')) + 'px');
            $liveFrame.css('top', $topLine.offset().top);
            $liveFrame.show();
        }
        else {
            $liveFrame.hide();
        }
    }

    function borderWidth($obj, side) {
        return Number($obj.css(`border${side}Width`).slice(0, -2));
    }


    $launchPresentation.click(function () {
        if (popup) {
            popup.close();
        }
        else {
            const initialWidth = 800;
            popup = window.open('presentation.html', '_blank', `height=${initialWidth / aspectRatio},width=${initialWidth},scrollbars=no`);
            popup.onload = function () {
                popup.onunload = function () {
                    popup = null;
                    $launchPresentation.text('Launch Presentation');
                };
            };
            $launchPresentation.text('Close Presentation');
        }
    });
});