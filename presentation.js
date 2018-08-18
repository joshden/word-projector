$(function() {

    const $fullscreen = $('#makePresentationFullscreen');

    $fullscreen.find('button').click(function() {
        $fullscreen.hide();
    });

    $fullscreen.find('button.makeFullscreen').click(function() {
        screenfull.request();
    });

});

