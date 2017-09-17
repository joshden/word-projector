$.get('songs.json', allSongs => {
    $('#songs').selectize({
        maxItems: null,
        valueField: 'id',
        labelField: 'title',
        searchField: 'title',
        options: allSongs,
        onChange: function(ids) {
            const selectedSongs = ids
                .map(id => parseInt(id, 10))
                .map(id => allSongs.find(song => song.id === id));

            $('#presenter').trigger('songs:change', [selectedSongs]);
        }
    });
});