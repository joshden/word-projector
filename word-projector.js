$(function() {
    const widthByHeight = [16, 9];
    const aspectRatio = widthByHeight[0] / widthByHeight[1];
    let popup = null;
    let $currentSelection = null;
    const $launchPresentation = $('#launchPresentation');
    const $liveFrame = $('#liveFrame');
    const $presenterFrame = $('#presenterFrame');
    const $presenterContents = $('#presenterContents');
    const activeClass = 'active';
    const activeArticle = 'article.' + activeClass;
    const topLineClass = 'top-line';
    let $presentationHtml = $();
    let $presentationFrame = $();
    let $presentationContents = $();
    let $presenterAndPresentation = $();

    $(window).resize(setPresenterFontSizeAndLiveFramePosition);

    let presentationScrolledAmount = 0;

    function borderWidth($obj, side) {
        return Number($obj.css(`border${side}Width`).slice(0, -2));
    }

    function setPresenterFontSizeAndLiveFramePosition() {
        const windowWidth = window.innerWidth;
        const presenterWidth = $presenterFrame.width();

        $presenterContents.css('font-size', (presenterWidth / windowWidth) + 'em');

        if ($currentSelection) {
            const liveFrameHeight = presenterWidth / aspectRatio;
            $liveFrame.css('height', String(liveFrameHeight - borderWidth($liveFrame, 'Top') - borderWidth($liveFrame, 'Bottom')) + 'px');
            $liveFrame.css('width', String(presenterWidth - borderWidth($liveFrame, 'Left') - borderWidth($liveFrame, 'Left')) + 'px');
            $liveFrame.css('top', $currentSelection.offset().top);
            $liveFrame.show();
        }
        else {
            $liveFrame.hide();
        }
    }

    function unselectSong() {
        $presenterAndPresentation.find(activeArticle).removeClass(activeClass);
    }

    function updatePresentationScrolledAmount() {
        const $topLine = $presentationContents.find('.' + topLineClass);
        if ($topLine.length) {
            presentationScrolledAmount += $topLine.offset().top;
        }
        else {
            presentationScrolledAmount = 0;
        }
    }

    function loadPresentationFromPresenter() {
        $currentSelection = null;
        setPresenterFontSizeAndLiveFramePosition();
        $presentationContents.find('article').remove();
        $presenterContents.find('article').clone().appendTo($presentationContents);
        $presentationHtml.find('title').text('');
    }

    function handlePresentationWindowResize() {
        const popupWidth = popup.document.documentElement.clientWidth; // popup.innerWidth;
        const popupHeight = popup.document.documentElement.clientHeight; // popup.innerHeight;
        console.log('popupWidth', popupWidth, 'popupHeight', popupHeight);

        if (popupWidth > popupHeight * aspectRatio) {
            const scaledFrameWidth = popupHeight * aspectRatio;
            $presentationFrame.css('width', scaledFrameWidth + 'px');
            $presentationFrame.css('height', popupHeight + 'px');
            $presentationContents.css('font-size', (scaledFrameWidth / popupWidth) + 'em');
        }

        else {
            $presentationFrame.css('width', '');
            $presentationFrame.css('height', (popupWidth / aspectRatio) + 'px');
            $presentationContents.css('font-size', '');
        }

        updatePresentationScrolledAmount();
        $presentationContents.css('margin-top', -presentationScrolledAmount);
    }

    $launchPresentation.click(function() {
        if (popup) {
            popup.close();
        }
        else {
            presentationScrolledAmount = 0;
            popup = window.open('presentation.html', '_blank', 'height=450,width=800,scrollbars=no');
            popup.onload = function() {
                $presentationHtml = $(popup.document).find('html');
                $presentationFrame = $presentationHtml.find('#presentationFrame');
                $presentationContents = $presentationFrame.find('#presentationContents');
                $presenterAndPresentation = $presenterContents.add($presentationContents);
                loadPresentationFromPresenter();
                $presenterFrame.addClass('presentation-active');
                popup.onunload = function() {
                    popup = null;
                    $presenterFrame.removeClass('presentation-active');
                    $launchPresentation.text('Launch Presentation');
                    $currentSelection = null;
                    setPresenterFontSizeAndLiveFramePosition();
                    unselectSong();
                };
                handlePresentationWindowResize();
            };
            $(popup).resize(handlePresentationWindowResize);
            $launchPresentation.text('Close Presentation');
        }
    });

    $presenterFrame.on('songs:change', (e, songs) => {
        function hymnalNumber(song) {
            return song.majestyNumber ? ` #${song.majestyNumber.toFixed()}` : '';
        }
        function authorText(song) {
            const author = song.author;
            if (author.hasOwnProperty('scriptureRef')) {
                return `From ${author.scriptureRef}`;
            }
            else if (author.hasOwnProperty('name')) {
                return `By ${author.name}`;
            }
            else if (author.hasOwnProperty('basedOn')) {
                return `Based on ${author.basedOn}`;
            }
            else if (author.hasOwnProperty('source')) {
                return author.source;
            }
            else if (author.hasOwnProperty('scripture')) {
                return author.scripture;
            }
            else if (author.hasOwnProperty('byWork')) {
                return author.byWork;
            }
            else if (author.traditional) {
                return 'Traditional'
            }
            else if (typeof author === 'string') {
                return author;
            }
            return '';
        }
        function fullAuthorText(song) {
            let fullText = authorText(song);
            const props = ['arrangedBy', 'adaptedBy', 'translatedBy', 'versifiedBy'];
            Object.getOwnPropertyNames(song).filter(prop => props.includes(prop)).forEach(propName => {
                if (fullText) {
                    fullText += '; ';
                }
                fullText += propName.substr(0, propName.length-2) + ' by ' + song[propName].name;
            });
            return fullText
        }
        function stanzasAndFooter(song) {
            return song.copyright ? '<footer><h1>(Words only in hymnal)</h1></footer>' : `
                ${song.stanzas.map(stanza => stanza.lines).map(lines => `
                <ol>${lines.map(line => `
                    <li>${escape(line)}</li>`).join('')}
                </ol>`).join('\n')
                }

                <footer>
                    <h1>${escape(song.title)}</h1>
                    <h2>${escape(fullAuthorText(song))}</h2>
                </footer>
            `;
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
                    <h1>${escape(song.title)}${hymnalNumber(song)}</h1>
                    <h2>${escape(authorText(song))}</h2>
                </header>
                ${stanzasAndFooter(song)}
            </article>
        `).join('');

        //console.log(wordsHtml);
        $presenterContents.html(wordsHtml);
        loadPresentationFromPresenter();

        $presenterContents.find('article header, article li').click(function() {
            if (popup) {
                $currentSelection = $(this);
                let doAnimateScroll = true;
                
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
                    
                    $presentationContents.find(scrollToSelector).addClass(topLineClass);
                    
                    if (isSwitchingArticle) {
                        doAnimateScroll = false;
                        unselectSong();
                        $presentationHtml.stop(true);
                        $presenterAndPresentation.find(articleSelector).addClass('active');
                        $presentationHtml.find('title').text($article.find('header').text());
                    }
                    
                    setPresenterFontSizeAndLiveFramePosition();
                }
                $currentSelection.toggleClass(topLineClass);
                
                updatePresentationScrolledAmount();
                if (doAnimateScroll) {
                    $presentationContents.animate({
                        marginTop: -presentationScrolledAmount
                    }, 1000);
                }
                else {
                    $presentationContents.css('margin-top', -presentationScrolledAmount);
                }
            }
        });
    });

});