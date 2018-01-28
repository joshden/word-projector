$(function() {
    let popup = null;
    let $currentSelection = null;
    const $launchPresentation = $('#launchPresentation');
    const $liveFrame = $('#liveFrame');
    const $presenter = $('#presenter');
    const activeClass = 'active';
    const activeArticle = 'article.' + activeClass;
    const topLineClass = 'top-line';
    let $presentationHtml = $();
    let $presentation = $();
    let $presenterAndPresentation = $();

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

    function unselectSong() {
        $presenterAndPresentation.find(activeArticle).removeClass(activeClass);
    }

    function loadPresentationFromPresenter() {
        $currentSelection = null;
        setLiveFramePosition();
        $presentation.find('article').remove();
        $presenter.find('article').clone().appendTo($presentation);
        $presentationHtml.find('title').text('');
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
        
        //console.log('presenterWidth', presenterWidth);
        setLiveFramePosition();
    }

    $launchPresentation.click(function() {
        if (popup) {
            popup.close();
        }
        else {
            popup = window.open('presentation.html', '_blank', 'height=300,width=700,scrollbars=no');
            popup.onload = function() {
                $presentationHtml = $(popup.document).find('html');
                $presentation = $presentationHtml.find('body#presentation');
                $presenterAndPresentation = $presenter.add($presentation);
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
                syncPresenterFontSize();
            };
            $(popup).resize(syncPresenterFontSize);
            $launchPresentation.text('Close Presentation');
        }
    });

    $presenter.on('songs:change', (e, songs) => {
        function authorText(song) {
            const author = song.author;
            if (author.hasOwnProperty('scriptureRef')) {
                return `From ${author.scriptureRef}`;
            }
            else if (author.hasOwnProperty('name')) {
                return `By ${author.name}`;
            }
            return '';
        }
        function escape(text) {
            const escaped = _.escape(text);
            
            const matched = escaped.match(/( +)([^ ]+)$/);
            if (matched) {
                const beforeLastSpaces = escaped.substr(0, escaped.length - matched[0].length);
                const nbspLastSpaces = matched[1].replace(/ /g, '&nbsp;');
                const afterLastSpaces = matched[2];
                return beforeLastSpaces + nbspLastSpaces + afterLastSpaces;
            }
            else {
                return escaped;
            }
        }
        const wordsHtml = songs.map(song => `
            <article>
                <header>
                    <h1>${escape(song.title)}</h1>
                    <h2>${escape(authorText(song))}</h2>
                </header>
                ${song.stanzas.map(stanza => stanza.lines).map(lines => `
                <ol>${lines.map(line => `
                    <li>${escape(line)}</li>`).join('')}
                </ol>`).join('\n')
                }

                <footer>
                    <h1>${escape(song.title)}</h1>
                    <h2>${escape(authorText(song))}</h2>
                </footer>
            </article>
        `).join('');

        //console.log(wordsHtml);
        $presenter.html(wordsHtml);
        loadPresentationFromPresenter();

        $presenter.find('article header, article li').click(function() {
            if (popup) {
                $currentSelection = $(this);
                
                if ($currentSelection.hasClass(topLineClass)) {
                    unselectSong();
                }
                else {
                    $presenterAndPresentation.find('.' + topLineClass).removeClass(topLineClass);

                    const $article = $currentSelection.parents('article').first();
                    const articleSelector = `article:nth-of-type(${$article.prevAll('article').length + 1})`;
    
                    const isSwitchingArticle = $(articleSelector).get(0) !== $(activeArticle).get(0);
                    const scrollToSelector = articleSelector + (
                        $currentSelection.is('header') ? '' 
                        : `> ol:nth-of-type(${$currentSelection.parent().prevAll('ol').length + 1}) > li:nth-of-type(${$currentSelection.prevAll('li').length + 1})`);
                    
                    const popupScrollTop = $presentation.find(scrollToSelector).offset().top;
    
                    if (isSwitchingArticle) {
                        unselectSong();
                        $presentationHtml.stop(true);
                        $presentationHtml.scrollTop(popupScrollTop);
                        $presenterAndPresentation.find(articleSelector).addClass('active');
                        $presentationHtml.find('title').text($article.find('header').text());
                    }
    
                    else {
                        $presentationHtml.animate({
                            scrollTop: popupScrollTop
                        }, 1000);
                    }
                    
                    setLiveFramePosition();
                }
                $currentSelection.toggleClass(topLineClass);
            }
        });
    });

});