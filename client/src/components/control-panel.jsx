// React imports
import React, {Component, PropTypes} from "react";

// Grid imports
import ReactGridLayout, {WidthProvider} from "react-grid-layout";
let ResponsiveGrid = WidthProvider(ReactGridLayout.Responsive);

// Redux container components
import MasterControlContainer from "containers/master-control-container";
import InstrumentContainer from "containers/instrument-container";


class ControlPanel extends Component {
    constructor(props) {
        super(props);

        this.props.actionFetchMetaRequest();

        if (props._query.viewId) {
            this.props.actionLoadView(+props._query.viewId);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (this.props._query !== nextProps._query) {
            this.props.actionLoadView(+nextProps._query.viewId);
        }
    }

    render() {
        // Use saved grid layout where possible, and use default grid for any missing.
        let layout = this.props.view.layout;

        return <div>
            <MasterControlContainer
                //thumbs={[]}        //TODO: Get the layout items in thumbnail state, to show here
            />
            <ResponsiveGrid
                // Responsive layout should scale for lg = 2x4k, m = 1080pHD, s = mobile, xs = min scale
                ref="reactGridLayout"
                className="controlPanel"
                breakpoints={{
                    lg: 4320,
                    m: 1080,
                    s: 600,
                    xs: 0
                }}
                cols={{
                    lg: 9,
                    m: 6,
                    s: 2,
                    xs: 1
                }}
                rowHeights={{
                    lg: 540,
                    m: 240,
                    s: 120,
                    xs: 0
                }}
                layouts={{
                    //TODO: There must be a better way to vary this. Scale from lg to proportional smaller sizes?
                    lg: layout,
                    m: layout,
                    s: layout,
                    xs: layout
                }}
                draggableHandle=".grid-handle"
                //autosize={true}
                useCSSTransforms={true}
                onResizeStop={this.onResizeStop}
                onWidthChange={this.onWidthChange}
                onDragStop={this.onDragStop}
            >
                {this.getInstrumentComponents()}
            </ResponsiveGrid>
        </div>;
    }

    getInstrumentComponents = () => {
        return this.props.view.instruments.map(instrument => {
            let grid = this.getGridLayoutForInstrument(instrument);

            return <div key={instrument.id} _grid={grid}>
                <InstrumentContainer
                    instrument={instrument}
                />
            </div>;
        });
    };

    getGridLayoutForInstrument = instrument => {
        return _.find(this.props.view.layout, grid => grid.i === instrument.id)
        ;
    };

    onResizeStop = (layout, oldItem, newItem, placeholder, e, element) => {
        this.props.actionUpdateLayoutGrid(newItem);

        //TODO: might be a better way to make instrument respond to size change, like props, or direct element update
        this.forceUpdate();
    };

    onDragStop = (layout, oldItem, newItem, placeholder, e, element) => {
        this.props.actionUpdateLayoutGrid(newItem);
    };

    onWidthChange = (containerWidth, margin, cols) => {
        //TODO: might be a better way to make instrument respond to size change, like props
        this.forceUpdate();
    };
}


/*
    Exports
 */

export default ControlPanel;

