import WordProjector from "./word-projector";
import $ from 'jquery';
import _ from 'lodash';
import Song from "./song";
require('jquery-ui/ui/widgets/sortable');
require('selectize');

export default function songPlanner(wordProjector: WordProjector) {
$(function() {
    const $select = $('#songs');
    let allSongs: Song[] = [];
    let previousIds: string[] = [];
    let doKeepChange = false;

    function asSelectize(value: any) {
        return value as Selectize.IApi<any, any>
    }

    $select.selectize({
        plugins: ['remove_button', 'drag_drop', 'restore_on_backspace'],
        maxItems: 9999,
        valueField: 'id',
        labelField: 'title',
        searchField: 'title',
        options: allSongs,
        onChange: function(ids: string[]) {
            if (doKeepChange) {
                doKeepChange = false;
                previousIds = ids;
            }
            else if (! _.isEqual(previousIds, ids)) {
                doKeepChange = true;
                asSelectize(this).setValue(previousIds);
                wordProjector.changeSongs(ids.map(id => parseInt(id, 10)));
            }
        },

        openOnFocus: false,
        onInitialize: function() {
            var that = asSelectize(this);
            (this as any).$control.on('mousedown', function(this: any) {
                const el = this;
                $()
                if ($(el).find('input').is(':focus') && ! el.didClose) {
                    el.didClose = true;
                    that.close();
                }
                else {
                    el.didClose = false;
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
        const ids = songs.map((song: Song) => song.id);

        doKeepChange = true;
        selectize.setValue(ids);
    });
});
}