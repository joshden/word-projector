import songPlanner from './song-planner';
import presenter from './presenter';
import WordProjector from './word-projector';

const wordProjector = new WordProjector();
songPlanner(wordProjector);
presenter(wordProjector);