$(function() {
    let popup = null;

    $('#launchPresentation').click(function() {
        if (popup) {
            popup.close();
            popup = null;
            $(this).text('Launch Presentation');
        }
        else {
            popup = window.open('presentation.html', '_blank', 'height=300,width=700,scrollbars=no');
            popup.onload = function() {
                $('.presenter > article').clone().appendTo(popup.document.body);
            };
            $(this).text('Close Presentation');
        }
    });

    $('li').click(function() {
        const olCssNthChild = $(this).parent().prevAll('ol').length + 1;
        const liCssNthChild = $(this).prevAll('li').length + 1;

        const selector = 'article > ol:nth-of-type('+olCssNthChild+') > li:nth-of-type('+liCssNthChild+')';
        console.log(this, selector);

        popup.$('html, body').animate({
            scrollTop: popup.$(selector).offset().top
        }, 1000);
        
    });

});