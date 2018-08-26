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
    let $presentationBottomFade = $();
    let $presenterAndPresentation = $presenterContents;

    $(window).resize(setPresenterFontSizeAndLiveFramePosition);

    let presentationScrolledAmount = 0;

    function borderWidth($obj, side) {
        return Number($obj.css(`border${side}Width`).slice(0, -2));
    }

    function setPresenterFontSizeAndLiveFramePosition() {
        const windowWidth = window.innerWidth;
        const presenterWidth = $presenterFrame.width();

        $presenterContents.css('font-size', (presenterWidth / windowWidth) + 'em');

        setLiveFramePosition();
    }

    function setLiveFramePosition() {
        const presenterWidth = $presenterFrame.width();

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
            presentationScrolledAmount = -$presentationContents.offset().top + $topLine.offset().top;
        }
        else {
            presentationScrolledAmount = 0;
        }
    }

    let plannedSongs = [];

    function loadPresentationSongs(plannedSongs) {
        const songsHtml = getSongsHtml(plannedSongs);
        $currentSelection = null;
        setPresenterFontSizeAndLiveFramePosition();
        $presentationContents.find('article').remove();
        $presentationContents.append(songsHtml)
    }

    function handlePresentationWindowResize() {
        const popupWidth = popup.document.documentElement.clientWidth;
        const popupHeight = popup.document.documentElement.clientHeight;

        if (popupWidth > popupHeight * aspectRatio) {
            const scaledFrameWidth = popupHeight * aspectRatio;
            $presentationFrame.css('width', scaledFrameWidth + 'px');
            $presentationFrame.css('height', popupHeight + 'px');
            $presentationContents.add($presentationBottomFade).css('font-size', (scaledFrameWidth / popupWidth) + 'em');
        }

        else {
            $presentationFrame.css('width', '');
            $presentationFrame.css('height', (popupWidth / aspectRatio) + 'px');
            $presentationContents.add($presentationBottomFade).css('font-size', '');
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
            const initialWidth = 800;
            popup = window.open('presentation.html', '_blank', `height=${initialWidth/aspectRatio},width=${initialWidth},scrollbars=no`);
            popup.onload = function() {
                $presentationHtml = $(popup.document).find('html');
                $presentationFrame = $presentationHtml.find('#presentationFrame');
                $presentationContents = $presentationFrame.find('#presentationContents');
                $presentationBottomFade = $presentationFrame.find('#presentationBottomFade');
                $presenterAndPresentation = $presenterContents.add($presentationContents);
                loadPresentationSongs(plannedSongs);
                $presenterFrame.addClass('presentation-active');
                popup.onunload = function() {
                    popup = null;
                    $presenterFrame.removeClass('presentation-active');
                    $launchPresentation.text('Launch Presentation');
                };
                handlePresentationWindowResize();
                unselectSong();
                socket.emit('songLine:ready');
            };
            $(popup).resize(handlePresentationWindowResize);
            $launchPresentation.text('Close Presentation');
        }
    });

    function getSongsHtml(songs) {
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
        const songsHtml = songs.map(song => `
            <article>
                <header>
                    <h1>${escape(song.title)}${hymnalNumber(song)}</h1>
                    <h2>${escape(authorText(song))}</h2>
                </header>
                ${stanzasAndFooter(song)}
            </article>
        `).join('');

        return songsHtml;
    }

    $presenterFrame.on('songs:change', (e, songs) => {
        plannedSongs = songs;
        loadPresentationSongs(plannedSongs);
    });

    $presenterFrame.on('songs:change', (e, songs) => {
        const songsHtml = getSongsHtml(songs);
        $presenterContents.html(songsHtml);

        $presenterContents.find('article header, article li').click(function() {
            if (popup) {
                const $clickedLine = $(this);
                const $article = $clickedLine.parents('article').first();
                const isHeader = $clickedLine.is('header');

                const song = $article.prevAll('article').length;
                const stanza = isHeader ? null : $clickedLine.parent().prevAll('ol').length;
                const line = isHeader ? null : $clickedLine.prevAll('li').length;
                const shouldUnselect = $clickedLine.hasClass(topLineClass);

                socket.emit(`songLine:${shouldUnselect?'un':''}select`, song, stanza, line);
            }
        });
    });

    socket.on('songLine:select', (song, stanza, line) => {
        const { articleSelector, isSwitchingArticle, scrollToSelector } = setCurrentSelectionAndStopAnimationAndGetInfo(song, stanza, line);
        $presenterAndPresentation.find('.' + topLineClass).removeClass(topLineClass);
        $presentationContents.find(scrollToSelector).addClass(topLineClass);
        if (isSwitchingArticle) {
            doAnimateScroll = false;
            unselectSong();
            $presenterAndPresentation.find(articleSelector).addClass('active');
        }
        setLiveFramePosition();
        selectLineAndAnimate(!isSwitchingArticle);
    });

    socket.on('songLine:unselect', (song, stanza, line) => {
        setCurrentSelectionAndStopAnimationAndGetInfo(song, stanza, line);
        unselectSong();
        setLiveFramePosition();
        selectLineAndAnimate(true);
    });

    function setCurrentSelectionAndStopAnimationAndGetInfo(song, stanza, line) {
        const articleSelector = `article:nth-of-type(${song + 1})`;
        const isSwitchingArticle = $(articleSelector).get(0) !== $(activeArticle).get(0);
        const scrollToSelector = articleSelector + (
            line === null ? '> header' 
            : `> ol:nth-of-type(${stanza + 1}) > li:nth-of-type(${line + 1})`);

        $currentSelection = $presenterContents.find(scrollToSelector);
        $presentationContents.stop(true);
        return { articleSelector, isSwitchingArticle, scrollToSelector };
    }

    function selectLineAndAnimate(doAnimateScroll) {
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