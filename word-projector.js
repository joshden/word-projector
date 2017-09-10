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
        
        function setActive($article) {
            const $activeArticle = $('article.active')
            if ($article.get(0) !== $activeArticle.get(0)) {
                $activeArticle.removeClass('active');
                $article.addClass('active');
            }
        }

        $('#presenter article header').add('#presenter article li').click(function() {
            const $article = $(this).parents('article').first();
            setActive($article);

            const articleCssNthChild = $article.prevAll('article').length + 1;
            const selector = `article:nth-of-type(${articleCssNthChild})` + (
                $(this).is('header') ? '' 
                : `> ol:nth-of-type(${$(this).parent().prevAll('ol').length + 1}) > li:nth-of-type(${$(this).prevAll('li').length + 1})`);
            
            popup.$('html, body').animate({
                scrollTop: popup.$(selector).offset().top
            }, 1000);
        });
    });

});