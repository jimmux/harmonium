import {connect} from "react-redux"
import {
    loadView,
    updateLayoutGrid,
    fetchMetaRequest
} from "actions"
import ControlPanel from "components/control-panel"


const mapStateToProps = (state, ownProps) => {
    return {
        view: state.view
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        actionLoadView: viewId => {
            dispatch(loadView(viewId))
        },
        actionUpdateLayoutGrid: grid => {
            dispatch(updateLayoutGrid(grid))
        },
        actionFetchMetaRequest: () => {
            dispatch(fetchMetaRequest())
        }
    }
};

const ControlPanelContainer = connect(
    mapStateToProps,
    mapDispatchToProps
)(ControlPanel);

export default ControlPanelContainer;

