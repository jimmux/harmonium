import {combineReducers} from "redux";
import {statusValue} from "symbols";
import _ from "lodash";


/* Defaults */
let defaultState = {
    selected: [],
    related: [],
    queryPath: [],      //TODO: replace with queryTree
    queryTree: [],      // ids of relationships in metadata.relationships
    view: {
        instruments: [],
        layout: []
    },
    status: {
        value: statusValue.loading,
        message: ""
    },
    metadata: {
        entities: {},
        attributes: {},
        relationships: {},
        hierarchyRoots: {}
    }
};


/*
    Selection reducers
 */

function selected(state = defaultState.selected, action = {}) {
    switch (action.type) {
        case "CLEAR_SELECTION":
            return [];
        case "FETCH_SELECTION_SUCCESS":
            return [...action.selectedIds];
        default:
            return state;
    }
}

function related(state = defaultState.related, action = {}) {
    switch (action.type) {
        case "CLEAR_SELECTION":
            return [];
        case "FETCH_SELECTION_SUCCESS":
            return [...action.relatedIds];
        default:
            return state;
    }
}

function queryPath(state = defaultState.queryPath, action = {}) {
    switch (action.type) {
        case "SET_QUERY_PATH":
            return [...action.queryPath];
        default:
            return state;
    }
}

function queryTree(state = defaultState.queryTree, action = {}) {
    switch (action.type) {
        case "SET_QUERY_TREE":
            return [...action.queryTree];
        default:
            return state;
    }
}


/*
    View reducers
 */

function view(state = defaultState.view, action = {}) {
    switch (action.type) {
        case "CREATE_INSTRUMENT":
        case "REMOVE_INSTRUMENT":
        case "LOAD_VIEW_SUCCESS":
            return {
                ...state,
                instruments: instruments(state.instruments, action),
                layout: layout(state.layout, action)
            };

        case "SET_MODE":
        case "SET_ENTITIES":
        case "SET_TITLE":
        case "SET_CONFIG":
            return {
                ...state,
                instruments: instruments(state.instruments, action)
            };

        case "UPDATE_LAYOUT_GRID":
            return {
                ...state,
                layout: layout(state.layout, action)
            };

        default:
            return state;
    }
}


function instruments(state = [], action = {}) {
    switch (action.type) {
        case "CREATE_INSTRUMENT":
            action.id = String(state.reduce((acc, instrument) => Math.max(acc, parseInt(instrument.id)), 0) + 1);
            return [
                ...state,
                instrument(undefined, action)
            ];
        case "REMOVE_INSTRUMENT":
            let newState = state
                .slice()
                .filter(instrument => instrument.id !== action.id)
            ;
            return newState;

        case "SET_MODE":
        case "SET_ENTITIES":
        case "SET_TITLE":
        case "SET_CONFIG":
            return state.map(d => instrument(d, action));

        case "LOAD_VIEW_SUCCESS":
            if (!action.view.instruments) return [];
            return action.view.instruments.map(d => instrument(d, action));

        default:
            return state;
    }
}

function instrument(state = {}, action = {}) {
    switch (action.type) {
        case "CREATE_INSTRUMENT":
            return {
                type: action.name,
                id: action.id,
                config: action.config,
                mode: _.isEmpty(action.config) ? "config" : "load",
                entities: [],
                title: ""
            };

        case "SET_MODE":
            return (state.id === action.id) ? {...state, mode: action.mode} : state;

        case "SET_ENTITIES":
            return (state.id === action.id) ? {...state, entities: action.entities} : state;

        case "SET_TITLE":
            return (state.id === action.id) ? {...state, title: action.title} : state;

        case "SET_CONFIG":
            let oldConfig = state.config || {};
            let newConfig = action.config || {};
            let config = {...oldConfig, ...newConfig};
            return (state.id === action.id) ? {...state, config} : state;

        case "LOAD_VIEW_SUCCESS":
            return {
                ...state,
                mode: _.isEmpty(action.config) ? "config" : "load",
                entities: [],
                title: ""
            };

        default:
            return state;
    }
}

function layout(state = [], action = {}) {
    switch (action.type) {
        case "CREATE_INSTRUMENT":
            action.id = String(state.reduce((acc, grid) => Math.max(acc, parseInt(grid.i)), 0) + 1);
            return [
                ...state,
                grid(undefined, action)
            ];
        case "REMOVE_INSTRUMENT":
            let newState = state
                .slice()
                .filter(layout => layout.i !== action.id)
            ;
            return newState;

        case "UPDATE_LAYOUT_GRID":
            return state.map(d => grid(d, action));

        case "LOAD_VIEW_SUCCESS":
            if (!action.view.layout) return [];
            return action.view.layout.map(d => grid(d, action));

        default:
            return state;
    }
}

function grid(state = {}, action = {}) {
    switch (action.type) {
        case "CREATE_INSTRUMENT":
            return {
                i: action.id,
                x: 0,
                y: 0,
                h: 2,
                w: 2
            };

        case "UPDATE_LAYOUT_GRID":
            let grid = action.grid;
            return (state.i === grid.i) ? {...state, ...grid} : state;

        case "LOAD_VIEW_SUCCESS":
            return {
                x: 0,
                y: 0,
                h: 2,
                w: 2,
                ...state
            };

        default:
            return state;
    }
}


/*
    Status reducers
 */

function status(state = defaultState.status, action = {}) {
    switch (action.type) {
        case "FETCH_META_SUCCESS":
            return {
                value: statusValue.ready,
                message: ""
            };
        default:
            return state;
    }
}


/*
    Metadata reducers
 */

function metadata(state = defaultState.metadata, action = {}) {
    switch (action.type) {
        case "FETCH_META_SUCCESS":
            return action.metadata;
        default:
            return state;
    }
}


/*
    Full state reducer
 */

const appState = combineReducers({
    selected,
    related,
    queryPath,
    queryTree,
    view,
    status,
    metadata
});


export default appState;
