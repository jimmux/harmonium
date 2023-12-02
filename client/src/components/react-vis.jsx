
import React, {Component, PropTypes} from "react";
import {Network, DataSet} from "vis";

export class VisNetwork extends Component {

    static defaultProps = {
        data: {
            // Just some very simple data to get something showing, and document expected structure
            nodes: [
                {id: 0, label: "no"},
                {id: 1, label: "data"},
                {id: 2, label: "available"}
            ],
            edges: [
                {from: 0, to: 1},
                {from: 1, to: 2}
            ]
        },
        width: "50",
        height: "50",
        selected: {
            nodes: [],
            edges: []
        },
        onEvent: {}
    };

    static events = [
        "click",
        "context",
        "hold",
        "release",
        "select",
        "selectNode",
        "selectEdge",
        "deselectNode",
        "deselectEdge",
        "dragStart",
        "dragging",
        "dragEnd"
        //TODO: add the rest...
    ];

    constructor(props) {
        super(props);

        this.dataSets = {};
    }

    render() {
        let style = {
            width: this.props.width,
            height: this.props.height,
            backgroundColor: "white"
        };

        return <div
            ref="container"
            style={style}
        />;
    }

    componentDidMount() {
        this.dataSets = {
            nodes: new DataSet(this.props.data.nodes),
            edges: new DataSet(this.props.data.edges)
        };

        // No vis in state, because it is independent of the React render
        // TODO: it could go in the state, updating it in componentWillReceiveProps
        this.vis = new Network(this.refs.container, this.dataSets, this.props.options);

        this.vis.setSelection(this.props.selected);

        // Register events
        for (let eventName of VisNetwork.events) {
            this.props.onEvent[eventName] && this.vis.on(eventName, this.props.onEvent[eventName]);
        }
    }

    componentDidUpdate() {
        // Get the nodes in the current dataset that aren't in the incoming data
        let expired = _.differenceBy(this.dataSets.nodes.get(), this.props.data.nodes, "id");
        // Remove them from the dataset
        this.dataSets.nodes.remove(expired);
        // Update for any new data
        this.dataSets.nodes.update(this.props.data.nodes);
        // Edges can just be replaced
        this.dataSets.edges.clear();
        this.dataSets.edges.add(this.props.data.edges);

        this.vis.setSelection(this.props.selected);

        //Fix any changes to registered events
        for (let eventName of VisNetwork.events) {
            this.vis.off(eventName);
            this.props.onEvent[eventName] && this.vis.on(eventName, this.props.onEvent[eventName]);
        }
    }
}

