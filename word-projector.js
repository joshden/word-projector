$(function() {
    let popup = null;

    function syncPresenterFontSize() {
        const popupWidth = popup.document.documentElement.clientWidth;
        //const popupHeight = popup.document.documentElement.clientHeight;
        const presenterWidth = document.documentElement.clientWidth;
        //const presenterHeight = document.documentElement.clientHeight;
        const presenterPercentage = String(presenterWidth / popupWidth * 100) + '%';
        $('#presenter').css('font-size', presenterPercentage);
        //console.log(presenterPercentage);
    }

    $('#launchPresentation').click(function() {
        if (popup) {
            popup.close();
            popup = null;
            $(this).text('Launch Presentation');
        }
        else {
            popup = window.open('presentation.html', '_blank', 'height=300,width=700,scrollbars=no');
            popup.onload = function() {
                $('#presenter > article').clone().appendTo(popup.document.body);
            };
            $(popup).resize(syncPresenterFontSize);
            $(window).resize(syncPresenterFontSize);
            $(this).text('Close Presentation');
        }
    });

    $.get('songs.json', songs => {
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
        $('#presenter').html(wordsHtml);

        $('#presenter article header').add('#presenter article li').click(function() {
            const $article = $(this).parents('article').first();
            const articleSelector = `article:nth-of-type(${$article.prevAll('article').length + 1})`;
            const $activeArticle = $('article.active');

            const isSwitchingArticle = $(articleSelector).get(0) !== $activeArticle.get(0);
            const scrollToSelector = articleSelector + (
                $(this).is('header') ? '' 
                : `> ol:nth-of-type(${$(this).parent().prevAll('ol').length + 1}) > li:nth-of-type(${$(this).prevAll('li').length + 1})`);
            
            const $popupHtmlBody = popup.$('html, body');
            const popupScrollTop = popup.$(scrollToSelector).offset().top;

            if (isSwitchingArticle) {
                $activeArticle.removeClass('active');
                popup.$('article.active').removeClass('active');

                $popupHtmlBody.scrollTop(popupScrollTop);

                $(articleSelector).addClass('active');
                popup.$(articleSelector).addClass('active');
            }

            else {
                $popupHtmlBody.animate({
                    scrollTop: popupScrollTop
                }, 1000);
            }
        });
    });

});