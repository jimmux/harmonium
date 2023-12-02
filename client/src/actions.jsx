import _ from "lodash";


// Initialise ID tracking for instruments
//let nextId = 0;
//let getNextId = () => String(nextId++);


/*
    General action creators
 */

function setStatus(value, message = "") {
    return {
        type: "SET_STATUS",
        value,
        message
    }
}


/*
    Selection action creators
 */

//TODO: Use this to show request in progress.
//function fetchSelectionStart() {
//    return {
//        type: "FETCH_SELECTION_START"
//    }
//}

function fetchSelectionFailed(error) {
    console.error(error);
    return {
        type: "FETCH_SELECTION_FAILED",
        error
    }
}

function fetchSelectionSuccess(selectedIds, relatedIds) {
    return {
        type: "FETCH_SELECTION_SUCCESS",
        selectedIds,
        relatedIds
    }
}

export function clearSelection() {
    return {
        type: "CLEAR_SELECTION"
    }
}

export function setQueryPath(queryPath) {
    // We want to fetch the new related ids every time the query path changes
    return function (dispatch, getState) {
        dispatch({
            type: "SET_QUERY_PATH",
            queryPath
        });

        let state = getState();
        fetchSelectionRequest(state.selected, state.queryPath)(dispatch);
    }
}

export function setQueryTree(queryTree) {
    // We want to fetch the new related ids every time the query tree changes
    return function (dispatch, getState) {
        dispatch({
            type: "SET_QUERY_TREE",
            queryTree
        });

        let state = getState();
        fetchSelectionRequest(state.selected, state.queryTree)(dispatch);
    }
}

export function fetchSelectionRequest(selectedIds, queryPath) {
    // Get all the ids related to the given selection, then update state with the full selection
    return function (dispatch) {
        let pathQuery = queryPath.join(",");
        let selectedQuery = selectedIds.join(",");
        let url = `http://localhost:3000/related-by-path?path=${pathQuery}&ids=${selectedQuery}`;
        return fetch(url)
            .then(response => response.json())
            .then(relatedIds => dispatch(fetchSelectionSuccess(selectedIds, relatedIds)))
            //.catch(error => dispatch(fetchSelectionFailed(error)))
        ;
    };
}

export function fetchSelectionForTreeRequest(selectedIds, queryTree) {
    // Get all the ids related to the given selection, then update state with the full selection
    return function (dispatch) {
        let treeQuery = queryTree.join(",");
        let selectedQuery = selectedIds.join(",");
        let url = `http://localhost:3000/related-by-tree?tree=${treeQuery}&ids=${selectedQuery}`;
        return fetch(url)
            .then(response => response.json())
            .then(relatedIds => dispatch(fetchSelectionSuccess(selectedIds, relatedIds)))
            ;
    };
}


/*
    View action creators
 */

export function createInstrument(name, config = {}) {
    return {
        type: "CREATE_INSTRUMENT",
        name,
        config
    }
}

export function removeInstrument(id) {
    return {
        type: "REMOVE_INSTRUMENT",
        id
    }
}

export function setMode(id, mode) {
    return {
        type: "SET_MODE",
        id,
        mode
    }
}

export function setEntities(id, entities) {
    return {
        type: "SET_ENTITIES",
        id,
        entities
    }
}

export function setTitle(id, title) {
    return {
        type: "SET_TITLE",
        id,
        title
    }
}

export function setConfig(id, config) {
    return {
        type: "SET_CONFIG",
        id,
        config
    }
}

export function updateLayoutGrid(grid) {
    return {
        type: "UPDATE_LAYOUT_GRID",
        grid
    }
}

function loadViewSuccess(view) {
    return {
        type: "LOAD_VIEW_SUCCESS",
        view
    }
}

function loadViewFailed(error) {
    console.error(error);
    return {
        type: "LOAD_VIEW_FAILED",
        error
    }
}

function saveViewSuccess(viewId) {
    return {
        type: "SAVE_VIEW_SUCCESS",
        viewId
    }
}


// Async (thunk) creators

export function loadView(viewId) {
    return function (dispatch, getState) {
        let url = "http://localhost:3000/get-note-view/" + viewId;
        fetch(url)
            .then(response => response.json())
            .then(view => dispatch(loadViewSuccess(view)))
            .catch(error => dispatch(loadViewFailed(error)))
        ;
    };
}

export function saveView(viewId) {
    return function (dispatch, getState) {
        let view = getState().view;
        let url = `http://localhost:3000/update-note-view/${viewId}?view=${JSON.stringify(view)}`;
        fetch(url)
            .then(response => response.json())
            .then(json => dispatch(saveViewSuccess(viewId)))
        ;
    };
}


/*
    Metadata action creators
 */

//TODO: Use this to show request in progress.
//function fetchMetaStart() {
//    return {
//        type: "FETCH_META_START"
//    }
//}

function fetchMetaFailed(error) {
    console.error(error);
    return {
        type: "FETCH_META_FAILED",
        error
    }
}

function fetchMetaSuccess(metadata) {
    let colourStack = [
        "saddlebrown",
        "yellowgreen",
        "purple",
        "orangered",
        "crimson",
        "gold",
        "orchid",
        "olive",
        "slateblue",
        "turquoise",
        "peru",
        "steelblue",
        "seagreen"
    ];
    for (let entity of _.values(metadata.entities)) {
        entity.colour = colourStack.pop() || "black";
    }

    return {
        type: "FETCH_META_SUCCESS",
        metadata
    }
}

export function fetchMetaRequest() {
    return function (dispatch) {
        return fetch("http://localhost:3000/metadata")
            .then(response => response.json())
            .then(metadata => dispatch(fetchMetaSuccess(metadata)))
        ;
    };
}
