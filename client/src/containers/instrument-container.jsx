import {connect} from "react-redux";
import {
    clearSelection,
    fetchSelectionRequest,
    fetchSelectionForTreeRequest,
    createInstrument,
    removeInstrument,
    setMode,
    setConfig,
    setEntities,
    setTitle,
    loadView,
    saveView,
    setQueryPath
} from "actions";
import Instrument from "components/instrument";


const mapStateToProps = (state, ownProps) => {
    return {
        selected: state.selected,
        related: state.related,
        queryPath: state.queryPath,
        queryTree: state.queryTree,
        view: state.view,
        metadata: state.metadata
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        actionClearSelection: () => {
            dispatch(clearSelection())
        },
        actionFetchSelectionForPath: (selectedIds, queryPath) => {
            dispatch(fetchSelectionRequest(selectedIds, queryPath))
        },
        actionFetchSelectionForTree: (selectedIds, queryTree) => {
            dispatch(fetchSelectionForTreeRequest(selectedIds, queryTree))
        },
        actionCreateInstrument: (name, config) => {
            dispatch(createInstrument(name, config))
        },
        actionRemoveInstrument: id => {
            dispatch(removeInstrument(id))
        },
        actionSetMode: (id, mode) => {
            dispatch(setMode(id, mode))
        },
        actionSetConfig: (id, config) => {
            dispatch(setConfig(id, config))
        },
        actionSetEntities: (id, entities) => {
            dispatch(setEntities(id, entities))
        },
        actionSetTitle: (id, title) => {
            dispatch(setTitle(id, title))
        },
        actionLoadView: (viewId) => {
            dispatch(loadView(viewId))
        },
        actionSaveView: (viewId, view) => {
            dispatch(saveView(viewId, view))
        },
        actionSetQueryPath: (queryPath) => {
            dispatch(setQueryPath(queryPath))
        },
        actionSetQueryTree: (queryTree) => {
            dispatch(setQueryTree(queryTree))
        }
    }
};

// For convenience, insert actionFetchSelection to get the queryPath itself.
const mergeProps = (stateProps, dispatchProps, ownProps) => {
    return {
        ...ownProps,
        ...stateProps,
        ...dispatchProps,
        actionFetchSelection: selectedIds => dispatchProps.actionFetchSelectionForPath(selectedIds, stateProps.queryPath)
        //TODO: need one for queryTree, which conveniently converts tree to something the server understands?
    };
};

const InstrumentContainer = connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
)(Instrument);

export default InstrumentContainer;

