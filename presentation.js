$(function() {

    $('#makePresentationFullscreen').click(function() {
        $(this).hide();
        //screenfull.request($('article')[0]);
        screenfull.request();
    });

});

