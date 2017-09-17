$(function() {
    let popup = null;
    let $currentSelection = null;
    const $launchPresentation = $('#launchPresentation');
    const $liveFrame = $('#liveFrame');
    const $presenter = $('#presenter');

    let popupWidth = 1920;
    let popupHeight = 1080;
    $(window).resize(syncPresenterFontSize);
    syncPresenterFontSize();

    function borderWidth($obj, side) {
        return Number($obj.css(`border${side}Width`).slice(0, -2));
    }

    function setLiveFramePosition() {
        if ($currentSelection) {
            $liveFrame.show();
            $liveFrame.css('top', $currentSelection.offset().top);
        }
        else {
            $liveFrame.hide();
        }
    }

    function getActiveArticle() {
        return $('article.active');
    }

    function unselectSong() {
        getActiveArticle().removeClass('active');
        if (popup) {
            popup.$('article.active').removeClass('active');
        }
    }

    function loadPresentationFromPresenter() {
        $currentSelection = null;
        setLiveFramePosition();
        if (popup) {
            popup.$('article').remove();
            $('#presenter > article').clone().appendTo(popup.document.body);
        }
    }

    function syncPresenterFontSize() {
        if (popup) {
            popupWidth = popup.document.documentElement.clientWidth;
            popupHeight = popup.document.documentElement.clientHeight;
        }
        const presenterWidth = document.documentElement.clientWidth;
        const presenterPercentage = String(presenterWidth / popupWidth * 100) + '%';
        $presenter.css('font-size', presenterPercentage);

        const liveFrameHeight = presenterWidth / popupWidth * popupHeight;
        $liveFrame.css('height', String(liveFrameHeight - borderWidth($liveFrame, 'Top') - borderWidth($liveFrame, 'Bottom')) + 'px');
        $liveFrame.css('width', String(presenterWidth - borderWidth($liveFrame, 'Left') - borderWidth($liveFrame, 'Left')) + 'px');
        setLiveFramePosition();
    }

    $launchPresentation.click(function() {
        if (popup) {
            popup.close();
        }
        else {
            popup = window.open('presentation.html', '_blank', 'height=300,width=700,scrollbars=no');
            popup.onload = function() {
                loadPresentationFromPresenter();
                $presenter.addClass('presentation-active');
                popup.onunload = function() {
                    popup = null;
                    $presenter.removeClass('presentation-active');
                    $launchPresentation.text('Launch Presentation');
                    $currentSelection = null;
                    setLiveFramePosition();
                    unselectSong();
                };
            };
            $(popup).resize(syncPresenterFontSize);
            syncPresenterFontSize();
            $launchPresentation.text('Close Presentation');
        }
    });

    $presenter.on('songs:change', (e, songs) => {
        const wordsHtml = songs.map(song => `
            <article>
                <header>${_.escape(song.title)}</header>            
                ${song.stanzas.map(stanza => stanza.lines).map(lines => `
                <ol>${lines.map(line => `
                    <li>${_.escape(line)}</li>`).join('')}
                </ol>`).join('\n')
                }

                <footer>${_.escape(song.title)}</footer>
            </article>
        `).join('');

        //console.log(wordsHtml);
        $presenter.html(wordsHtml);
        loadPresentationFromPresenter();

        $('#presenter article header').add('#presenter article li').click(function() {
            if (popup) {
                $currentSelection = $(this);
                const $article = $currentSelection.parents('article').first();
                const articleSelector = `article:nth-of-type(${$article.prevAll('article').length + 1})`;

                const isSwitchingArticle = $(articleSelector).get(0) !== getActiveArticle().get(0);
                const scrollToSelector = articleSelector + (
                    $currentSelection.is('header') ? '' 
                    : `> ol:nth-of-type(${$currentSelection.parent().prevAll('ol').length + 1}) > li:nth-of-type(${$currentSelection.prevAll('li').length + 1})`);
                
                const $popupHtmlBody = popup.$('html, body');
                const popupScrollTop = popup.$(scrollToSelector).offset().top;

                if (isSwitchingArticle) {
                    unselectSong();
                    $popupHtmlBody.scrollTop(popupScrollTop);

                    $(articleSelector).addClass('active');
                    popup.$(articleSelector).addClass('active');
                }

                else {
                    $popupHtmlBody.animate({
                        scrollTop: popupScrollTop
                    }, 1000);
                }
                
                setLiveFramePosition();
            }
        });
    });

});