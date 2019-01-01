import WordProjector from './word-projector';
import $ from 'jquery';

export default function presenter(wordProjector: WordProjector) {
    const aspectRatio = wordProjector.aspectRatio;
    const $launchPresentation = $('#launchPresentation');
    const $liveFrame = $('#liveFrame');
    const $presenterFrame = $('#presenterFrame');
    const $presenterContents = $('#presenterContents');
    const { activeArticleSelector, topLineClassName } = wordProjector;

    let popup: Window | null = null;

    wordProjector.$wordContents = $presenterContents;
    wordProjector.registerOnSongsChangeUpdateHtml($presenterContents, () => {
        setLiveFramePosition();

        $presenterContents.find('article h1, article h2, article h3, article li').click(function () {
            const $clickedLine = $(this);
            const $article = $clickedLine.parents('article').first();

            const song = $article.prevAll('article').length;
            const stanza = $clickedLine.parent().prevAll().length;
            const line = $clickedLine.prevAll().length;
            const shouldUnselect = $clickedLine.hasClass(topLineClassName) && $article.get(0) === $(activeArticleSelector).get(0);

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

        $presenterContents.css('font-size', ((presenterWidth as number) / windowWidth) + 'em');

        setLiveFramePosition();
    }

    function setLiveFramePosition() {
        const presenterWidth = $presenterFrame.width() as number;

        const $topLine = $('.' + topLineClassName);
        if ($topLine.length) {
            const liveFrameHeight = presenterWidth / aspectRatio;
            $liveFrame.css('height', String(liveFrameHeight - borderWidth($liveFrame, 'Top') - borderWidth($liveFrame, 'Bottom')) + 'px');
            $liveFrame.css('width', String(presenterWidth - borderWidth($liveFrame, 'Left') - borderWidth($liveFrame, 'Right')) + 'px');
            $liveFrame.css('top', ($topLine.offset() as JQuery.Coordinates).top);
            $liveFrame.show();
        }
        else {
            $liveFrame.hide();
        }
    }

    function borderWidth($obj: JQuery, side: 'Top' | 'Left' | 'Right' | 'Bottom') {
        return Number($obj.css(`border${side}Width`).slice(0, -2));
    }


    $launchPresentation.click(function () {
        if (popup) {
            popup.close();
        }
        else {
            const initialWidth = 800;
            popup = window.open('presentation.html', '_blank', `height=${initialWidth / aspectRatio},width=${initialWidth},scrollbars=no`);
            if (popup) {
                popup.onload = function () {
                    if (popup) {
                        popup.onunload = function () {
                            popup = null;
                            $launchPresentation.text('Launch Presentation');
                        };
                    }
                };
            }
            $launchPresentation.text('Close Presentation');
        }
    });
}