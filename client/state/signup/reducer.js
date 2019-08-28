/** @format */

/**
 * Internal dependencies
 */
import { combineReducers, withStorageKey } from 'state/utils';
import dependencyStore from './dependency-store/reducer';
import progress from './progress/reducer';
import optionalDependencies from './optional-dependencies/reducer';
import steps from './steps/reducer';
import flow from './flow/reducer';
import verticals from './verticals/reducer';
import prototyping from 'state/signup/prototyping/reducer';

export default withStorageKey(
	'signup',
	combineReducers( {
		dependencyStore,
		optionalDependencies,
		progress,
		steps,
		flow,
		verticals,
		prototyping,
	} )
);
