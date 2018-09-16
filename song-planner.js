$(function() {
    const $select = $('#songs');
    let allSongs = [];
    let previousIds = [];
    let doKeepChange = false;

    $select.selectize({
        plugins: ['remove_button', 'drag_drop', 'restore_on_backspace'],
        maxItems: null,
        valueField: 'id',
        labelField: 'title',
        searchField: 'title',
        options: allSongs,
        onChange: function(ids) {
            if (doKeepChange) {
                doKeepChange = false;
                previousIds = ids;
            }
            else if (! _.isEqual(previousIds, ids)) {
                doKeepChange = true;
                this.setValue(previousIds);
                wordProjector.changeSongs(ids.map(id => parseInt(id, 10)));
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

    wordProjector.registerOnSongsLoaded(songs => {
        let id = 0;
        allSongs = songs;
        allSongs.forEach(song => song.id = ++id);

        const selectize = $select[0].selectize;
        selectize.clear();
        selectize.clearOptions();
        selectize.load(callback => callback(allSongs))
    });

    wordProjector.registerOnSongsChange(songs => {
        const selectize = $select[0].selectize;
        const ids = songs.map(song => song.id);

        doKeepChange = true;
        selectize.setValue(ids);
    });
});