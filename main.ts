import songPlanner from './song-planner';
import presenter from './presenter';
import WordProjector from './word-projector';

import 'purecss/build/pure-min.css';
import 'purecss/build/grids-responsive-min.css';
import 'selectize/dist/css/selectize.default.css';
import './presentation.css';

const wordProjector = new WordProjector();
songPlanner(wordProjector);
presenter(wordProjector);