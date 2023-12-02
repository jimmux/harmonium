import {connect} from "react-redux"
import {
    clearSelection,
    fetchSelectionRequest,
    createInstrument
} from "actions"
import MasterControl from "components/master-control"


const mapStateToProps = (state, ownProps) => {
    return {
        selected: state.selected,
        related: state.related,
        queryPath: state.queryPath,
        metadata: state.metadata,
        status: state.status
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
        actionCreateInstrument: (name, config) => {
            dispatch(createInstrument(name, config))
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
    };
};

const MasterControlContainer = connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
)(MasterControl);

export default MasterControlContainer;

