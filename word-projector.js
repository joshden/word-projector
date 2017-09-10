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

        function handleSongLineClick() {
            const articleCssNthChild = $(this).parent().parent().prevAll('article').length + 1;
            const olCssNthChild = $(this).parent().prevAll('ol').length + 1;
            const liCssNthChild = $(this).prevAll('li').length + 1;

            const selector = 'article:nth-of-type('+articleCssNthChild+') > ol:nth-of-type('+olCssNthChild+') > li:nth-of-type('+liCssNthChild+')';

            popup.$('html, body').animate({
                scrollTop: popup.$(selector).offset().top
            }, 1000);
        }

        let $selectedSong = $();
        $('#presenter article').click(function() {
            $selectedSong.removeClass('active');
            $selectedSong.find('li').off('click');
            
            $selectedSong = $(this);
            $selectedSong.addClass('active');
            $selectedSong.find('li').click(handleSongLineClick);
        });
    });

});