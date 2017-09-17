$.get('songs.json', songs => {
    $('#songs').selectize({
        // maxItems: null,
        valueField: 'id',
        labelField: 'title',
        searchField: 'title',
        options: songs
    });
});