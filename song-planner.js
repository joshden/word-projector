$.get('data/songs.json', allSongs => {
    let id = 0;
    allSongs.forEach(song => song.id = ++id);
    let previousIds = [];
    const $select = $('#songs').selectize({
        plugins: ['remove_button', 'drag_drop', 'restore_on_backspace'],
        maxItems: null,
        valueField: 'id',
        labelField: 'title',
        searchField: 'title',
        options: allSongs,
        onChange: function(ids) {
            if (! _.isEqual(previousIds, ids)) {
                previousIds = ids;
                socket.emit('songs:change', ids.map(id => parseInt(id, 10)));
            }
        },

        openOnFocus: false,
        onInitialize: function() {
            var that = this;
            this.$control.on('mousedown', function() {
                if ($(this).find('input').is(':focus') && ! this.didClose) {
                    this.didClose = true;
                    that.close();
                }
                else {
                    this.didClose = false;
                    that.open();
                }
            });
        }
    });

    socket.on('songs:change', ids => {
        const selectize = $select[0].selectize;

        previousIds = ids.map(id => id.toString());
        selectize.setValue(ids);

        const songs = ids.map(id =>
            allSongs.find(song =>
                song.id === id));

        $('#presenterFrame').trigger('songs:change', [songs]);
    });
    
    socket.emit('songs:ready');
});