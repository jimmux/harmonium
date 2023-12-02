// React imports
import React, {Component, PropTypes} from "react";
import ReactDOM from "react-dom";
import {
    Button,
    ButtonGroup,
    ButtonToolbar,
    Glyphicon,
    Panel,
    Accordion,
    Table,
    Modal,
    Label,
    Badge,
    Well
} from "react-bootstrap";

// Utility imports
import _ from "lodash";
import d3 from "d3";
import three from "three";
import cola from "webcola";

// Component imports
import {GoogleMap, Marker} from "react-google-maps";
import {ProgressBar, Input, ButtonInput} from "react-bootstrap";
import {VisNetwork} from "components/react-vis";


export const NAME_MAP = {
    listSelected: "Selection List",
    listEntity: "Simple List",
    scatter: "Scatter Plot",
    map2d: "2D Map",
    icicle: "Icicle",
    news: "News",
    //chart: "Chart",
    notes: "Notes",
    //debug: "Debug",
    graphER: "Entity-Relationship Graph (D3/cola)",
    graphSelected: "Selection Graph (D3)",

    visER: "Entity-Relationship Graph (vis)",
    visSelected: "Selection Graph (vis)",
    visQueryTree: "Query Tree (vis)"
};

const STYLE = {
    //TODO: Move common styling here.
};

const VIS_OPTIONS = {
    edges: {
        arrows: {
            to: true
        },
        arrowStrikethrough: false,
        font: {
            strokeWidth: 2
        },
        scaling: {
            min: 2,
            max: 5,
            label: {
                enabled: false
            }
        }
    },
    nodes: {
        shape: "dot",
        font: {
            strokeWidth: 2
        },
        color: {
            border: "lightgray",
            highlight: {
                border: "black"
            }
        },
        scaling: {
            min: 10,
            max: 20
        }
    }
};


class Instrument extends Component {
    constructor(props) {
        super(props);

        this.state = {
            width: 0,
            height: 0
        };
    }

    componentDidMount() {
        this.updateContent();
    }

    componentDidUpdate() {
        this.updateContent();
    }

    render() {
        let styles = {
            instrument: {
                backgroundColor: "whitesmoke",
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0px 5px 10px #223",
                animationName: "glow-in",
                animationDuration: "0.5s"
            },
            header: {
                backgroundColor: "white",
                cursor: "pointer",
                margin: 0,
                padding: "0.5ex 0.5em",
                height: "2em",
                borderBottom: "solid 2px whitesmoke"
            },
            content: {
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                position: "absolute",
                top: "2em",
                bottom: "0",
                width: "100%"
            },
            close: {
                position: "absolute",
                right: "0.5em"
            },
            text: {
                pointerEvents: "none"
            }
        };

        //TODO: Header should be a component, with title property
        return <div style={styles.instrument}>
            <div className="grid-handle" style={styles.header}>
                {this.getIconsHeader()}
                <span style={styles.text}>{this.getHeader()}</span>
                <span
                    onClick={event => this.props.actionRemoveInstrument(this.props.instrument.id)}
                    style={styles.close}
                    bsSize="xsmall"
                >
                    <Glyphicon glyph="remove" bsSize="xsmall"/>
                </span>

            </div>
            <div ref="content" style={styles.content}>
                {this.getContent()}
            </div>
        </div>;
    }

    getIconsHeader = () => {
        const R = 6;
        const GAP = 2;
        return <svg
            height={(R + GAP) * 2}
            width={this.props.instrument.entities.length * (R + GAP) * 2 + GAP }
        >
            {this.props.instrument.entities.map((d, i) =>
                <circle
                    key={d}
                    r={R}
                    cx={(R + GAP) * (i + 1)}
                    cy={R + GAP}
                    style={{
                        fill: this.props.metadata.entities[d].colour,
                        stroke: "none"
                    }}
                />
             )}
        </svg>;
    };

    getHeader = () => {
        let name = NAME_MAP[this.props.instrument.type] || "Default Instrument";

        switch (this.props.instrument.mode) {
            case "load": return `Loading ${name}...`;
            case "grid": return name + (this.props.instrument.title ? (": " + this.props.instrument.title) : "");
            default: return name;
        }
    };

    getContent = () => {
        let props = this.props;
        let state = this.state;
        let childProps = {
            ...props,
            ...state
        };

        switch (this.props.instrument.type) {
            case "scatter": return <ScatterPlot {...childProps} />;
            case "map2d": return <Map2d {...childProps} />;
            case "icicle": return <Icicle {...childProps} />;
            case "listSelected": return <ListSelected {...childProps} />;
            case "listEntity": return <ListEntity {...childProps} />;
            case "news": return <News {...childProps} />;
            case "chart": return <Chart {...childProps} />;
            case "graphER": return <GraphER {...childProps} />;
            case "graphSelected": return <GraphSelected {...childProps} />;
            case "notes": return <Notes {...childProps} />;

            case "visSelected": return <VisSelected {...childProps} />;
            case "visER": return <VisER {...childProps} />;
            case "visQueryTree": return <VisQueryTree {...childProps} />;

            default: return <Filler {...childProps} />;
        }
    };

    updateContent = () => {
        let contentNode = ReactDOM.findDOMNode(this.refs.content);
        if (!contentNode) return;

        let width = contentNode.clientWidth;
        let height = contentNode.clientHeight;

        if ((width !== this.state.width) || (height !== this.state.height)) {
            this.setState({
                width,
                height
            });
        }
    };
}



class VisSelected extends Component {
    // Uses vis.js to display the the currently selected data, with designated paths.
    //TODO: Handle very large results
    // * Needs to show a load indicator
    // * Ignore fetches of data if they aren't for the most recent selection
    // * Big fetches will not show the selected node as selected untiil it returns teh bog result
    // * Automatic clustering, probably all with common visible neighbours,
    //   then of the same type if they are over some threshold.

    constructor(props) {
        super(props);

        this.state = {
            graph: {
                nodes: [],
                edges: []
            },
            selected: {
                nodes: [],
                edges: []
            }
        };

        this.fetchDetails(props.selected, props.related);

        // Reference used to access the internal selection used by the vis network.
        // Kept out of state and model, so updates only happen when authorised by user.
        //this.preselection = props.selected;
    }

    componentWillReceiveProps(nextProps) {
        if ((nextProps.selected !== this.props.selected)
            || (nextProps.related !== this.props.related)
            || (nextProps.queryPath !== this.props.queryPath)
            || (nextProps.queryTree !== this.props.queryTree)
        ) {
            this.fetchDetails(nextProps.selected, nextProps.related);
        }
    }

    render() {
        let style = {
            control: {
                position: "absolute",
                left: 0,
                bottom: 0
            }
        };

        let options = {
            interaction: {
                multiselect: true,
                selectConnectedEdges: true,
                selectable: true
            },
            ...VIS_OPTIONS
        };

        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                // Normal mode, showing the graph with what data we have.
                return <div>
                    <VisNetwork
                        width={this.props.width}
                        height={this.props.height}
                        //data={this.graphToVis(this.state.graph)}
                        data={this.state.graph}
                        //selectionType="nodes"
                        selected={this.state.selected}
                        //actionFetchSelection={this.props.actionFetchSelection}
                        //onSelectionChange={this.setPreselection}
                        onEvent={{
                            select: this.onSelect
                        }}
                        //internalSelection={this.preselection}
                        options={options}
                    />
                    {/*<div style={style.control}>
                        <ButtonGroup>
                            <Button
                                bsSize="xsmall"
                                onClick={this.shareSelection}
                            ><Glyphicon glyph="share" /></Button>
                        </ButtonGroup>
                    </div>*/}
                </div>;
        }
    }

    onSelect = visEvent => {
        //this.preselection = visEvent.nodes;
        this.props.actionFetchSelection(visEvent.nodes);
    };

    fetchDetails = (selected, related) => {
        // Fetch details for the selected and related ids.

        let ids = selected.concat(related);

        if (!ids) {
            this.setState({
                graph: []
            });
            return;
        }

        let url = `http://localhost:3000/graph-by-id?ids=` + ids.join(",");
        fetch(url)
            .then(response => response.json())
            .then(graph => {
                this.setState({
                    graph: this.graphToVis(graph),
                    selected: {
                        nodes: selected,
                        edges: []
                    }
                });
            })
        ;
    };

    graphToVis = graph => {
        /*
            Graph looks like:
                [{
                    entity:
                    id:
                    node: {attribute_1:, attribute_2:, ...}
                    related: [id_1, id_2,...]
                }, ...]
            Make it like:
                {
                    nodes: [{id:, label:, value:, color:}, ...]
                    edges: [{from: id_1, to: id_2}, ...]
                }
         */

        const FORMAT_CURRENCY = d3.format("$,.2s");
        let nodes = graph.map(d => {
            const N = d.node;
            const COLOUR = this.props.metadata.entities[d.entity].colour;
            return {
                //...N,
                id: d.id,
                label: N.pretty
                    || N.name
                    || N.code
                    || (N.hasOwnProperty("amount") && FORMAT_CURRENCY(+N.amount))
                    || N.status
                    || N.description
                    || N.address
                    || N.number
                    || N.source_id
                    || "",
                value: +(N.amount || N.number || 0),
                color: {
                    background: COLOUR,
                    highlight: {
                        background: COLOUR
                    }
                }
            };
        });
        let edges = [];
        for (let g of graph) {
            for (let r of g.related) {
                edges.push({
                    from: g.id,
                    to: r
                });
            }
        }

        return {
            nodes,
            edges
        };
    };
}


class VisER extends Component {
    // Graph of the data structure captured in the metadata. i.e. the E-R diagram of the data.

    constructor(props) {
        super(props);

        this.state = {
            graph: {
                nodes: [],
                edges: []
            },
            selected: {
                nodes: [],      // id
                edges: []       // id
            }
        };
    }

    componentWillReceiveProps(nextProps) {
        // Convert metadata to expected graph, and convert queryPath to a selection.
        //TODO: Only works with a query path, but will be a query tree later. This will need to be fixed.
        let graph = {};
        graph.nodes = _.toPairs(this.props.metadata.entities).map((d, i) => ({
            id: d[0],
            label: d[0],
            title: d[1].count.toString(),
            value: d[1].count,
            color: {
                background: d[1].colour,
                highlight: {
                    background: d[1].colour
                }
            }
        }));
        graph.edges = [];
        for (let label of _.keys(this.props.metadata.relationships)) {
            let r = this.props.metadata.relationships[label];
            for (let shape of r.shapes) {
                graph.edges.push({
                    ...shape,
                    label,
                    value: shape.count
                });
            }
        }
        //TODO: Fix this when queryPath is converted to queryTree
        let selected = {
            edges: [],
            nodes:[]
        };
        let edgeBuffer = [];
        for (let i in this.props.queryPath) {
            let item = this.props.queryPath[i];
            if (i % 2) {
                // Edge
                edgeBuffer.push(item);
            }
            else {
                // Node
                selected.nodes.push(item);
                edgeBuffer.push(item);
                if (edgeBuffer.length > 2) {
                    let edge = _.find(graph.edges, {from: edgeBuffer[2], label: edgeBuffer[1], to: edgeBuffer[0]})
                        || _.find(graph.edges, {from: edgeBuffer[0], label: edgeBuffer[1], to: edgeBuffer[2]})
                    ;
                    edge && selected.edges.push(edge.id);

                    edgeBuffer = [edgeBuffer.pop()];
                }
            }
        }

        this.setState({
            graph,
            selected
        });
    }

    render() {

        let options = {
            interaction: {
                selectable: false,
                selectConnectedEdges: false
            },
            ...VIS_OPTIONS
        };

        //switch (this.props.layout.mode) {
        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                // Normal mode, showing the plot with what data we have.
                return <VisNetwork
                    width={this.props.width}
                    height={this.props.height}
                    data={this.state.graph}
                    //selectionType="none"
                    selected={this.state.selected}
                    options={options}
                    onEvent={{
                        dragEnd: this.fixDrag
                    }}
                />;
        }
    }

    fixDrag = visEvent => {
        // Workaround for bug with selections on drag
        //this.setState({
        //    graph: this.graph,
        //    selected: this.selected
        //});
        this.forceUpdate();
    };
}


class VisQueryTree extends Component {
    // Graph of the data structure captured in the metadata. i.e. the E-R diagram of the data.

    constructor(props) {
        super(props);

        this.state = {
            showDetail: false,
            detail: {
                subject: null,
                x: null,
                y: null,
                z: null
            },
            isValidQueryGraph: false
        };

        this.tempQueryTree = {
            nodes: [],
            edges: []
        };
    }

    render() {
        let style = {
            control: {
                position: "absolute",
                left: 0,
                bottom: 0
            }
        };

        let options = {
            interaction: {
                multiselect: true,
                selectConnectedEdges: false,
                selectable: true
            },
            ...VIS_OPTIONS
        };

        // Convert metadata to expected graph, and convert queryTree to a tree selection.
        // The graph data will be the selection, plus the nodes and edges that may be added.
        //TODO: Only works with a query path, but will be a tree later. This will need to be fixed.

        // Convert the queryTree to a vis graph representation - this will be the selection
        let graph = {
            nodes: [],
            edges: []
        };
        let selected = {
            nodes: [],
            edges: []
        };
        const SHADOW_PREFIX = "_";

        // The queryTree is a list of ids from metadata.relationships. Make it into a workable graph to grow or shrink it.
        if (this.props.queryTree.length) {
            // Show the query tree as the selected part of graph, and any directly connected nodes as the unselected part.
            // Unselected nodes may duplicate the selected nodes, but only once.
            // Unselected nodes with multiple connections to the selected part are not selectable, but the edges are.

        }
        else {
            // Show the whole ER graph, with only edges being selectable.
            for (let entity of _.keys(this.props.metadata.entities)) {
                let colour = this.props.metadata.entities[entity].colour;
                graph.nodes.push({
                        id: entity,
                        label: entity,
                        color: {
                            background: colour,
                            highlight: {
                                background: colour
                            }
                        }
                    }
                );
            }
            for (let r of _.keys(this.props.metadata.relationships)) {
                for (let shape of this.props.metadata.relationships[r].shapes) {
                    graph.edges.push({
                        id: shape.id,
                        label: r,
                        from: shape.from,
                        to: shape.to,
                        value: shape.count
                    });
                }
            }
        }

        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                // Normal mode, showing the plot with what data we have.
                return <div>
                    <VisNetwork
                        width={this.props.width}
                        height={this.props.height}
                        data={graph}
                        //selectionType="graph"
                        selected={selected}
                        onSelectionChange={this.setTempQueryTree}
                        options={options}
                    />
                    <div style={style.control}>
                        <ButtonGroup>
                            <Button
                                bsSize="xsmall"
                                onClick={this.shareQueryPath}
                            ><Glyphicon glyph="share" /></Button>
                            <Button
                                bsSize="xsmall"
                                onClick={event => this.toggleDetails()}
                            ><Glyphicon glyph="eye-open" /></Button>
                        </ButtonGroup>
                        <Modal show={this.state.showDetail} onHide={this.toggleDetails}>
                            <Modal.Header closeButton>
                                <Modal.Title>Path Details</Modal.Title>
                            </Modal.Header>
                            <Modal.Body>
                                <Table>
                                    <thead><tr>
                                        <th/><th>Name</th><th>Count</th><th>Subject</th><th>x</th><th>y</th><th>z</th>
                                    </tr></thead>
                                    <tbody>{
                                        this.props.queryPath.map((name, i) => (i % 2)
                                            ? this.getRelationshipDetail(
                                            this.props.queryPath[i - 1],
                                            name,
                                            this.props.queryPath[i + 1]
                                        )
                                            : this.getEntityDetail(name, i))
                                    }</tbody>
                                </Table>
                                <Button
                                    onClick={event => this.makeNewScatterPlot()}
                                    disabled={!this.state.detail.subject
                                        || !this.state.detail.x
                                        || !this.state.detail.y
                                        || !this.state.detail.z
                                    }
                                >Show scatter plot</Button>
                            </Modal.Body>
                        </Modal>
                    </div>
                </div>;
        }
    }

    setTempQueryTree = graph => {
        //TODO: Validate the path here, and disable the share button if not a valid query path.
        // Valid path must have no cycles so there can be only one path from any node to another.
        // Probably easier to enforce unbroken for now. I.e. a tree.
        // BUT, we need to allow self-looping edges.
        // May be able to do both checks in one - depth first search, flagging cycles if nodes repeat,
        // and broken if count of nodes found is less than total.
        // OR, use a different instrument to make the query graph, which can build out the graph starting
        // with a single node.

        this.tempQueryTree = graph;
    };

    shareQueryPath = () => {
        // Convert tempQueryTree to a proper query path and share with the rest of the app.
        // Do a validation check, to make sure it's a valid queryPath first!
        // Might need a way to set the subject entity first. Select from a list? Just keep linear paths?

        ///... convert tempQueryTree to a query path

        console.log(this.tempQueryTree);
        console.log(this.props.queryPath);
    };

    getEntityDetail = (entityName, i) => {
        let entity = this.props.metadata.entities[entityName];

        let style = {
            dot: {
                color: entity.colour
            },
            attributeName: {
                textIndent: "2em"
            }
        };

        let entityRow = <tr key={`entity_${entityName}_${i}`} style={style.entity}>
            <td style={style.dot}>⬤</td>
            <td>{entityName}</td>
            <td>{entity.count}</td>
            <td><Input
                type="radio"
                name="subject"
                wrapperClassName="col-xs-offset-2 col-xs-10"
                checked={entityName === this.state.detail.subject && i === this.state.detail.i}
                onChange={event => this.setSubject(entityName, i)}
            /></td>
            <td/>
            <td/>
            <td/>
        </tr>;
        if (!this.state.detail.subject) return entityRow;

        let rows = [];
        if (entityName === this.state.detail.subject && i === this.state.detail.i) {
            // Prepare an attribute config to pass to the plot.
            rows = entity.attributes.map(attributeName => <tr key={`attribute_${attributeName}`} >
                <td/>
                <td style={style.attributeName} >{attributeName}</td>
                <td/>
                <td/>
                <td><Input
                    type="radio"
                    name="x"
                    wrapperClassName="col-xs-offset-2 col-xs-10"
                    onChange={event => this.setAttribute("x", attributeName)}
                /></td>
                <td><Input
                    type="radio"
                    name="y"
                    wrapperClassName="col-xs-offset-2 col-xs-10"
                    onChange={event => this.setAttribute("y", attributeName)}
                /></td>
                <td><Input
                    type="radio"
                    name="z"
                    wrapperClassName="col-xs-offset-2 col-xs-10"
                    onChange={event => this.setAttribute("z", attributeName)}
                /></td>
            </tr>);
        }
        else {
            // Prepare an aggregate config to pass to the plot.
            let attributeNames = this.props.metadata.entities[entityName].attributes;
            let canSum = ["currency", "float", "integer"];
            let rowsSum = attributeNames
                    .filter(attributeName => _.includes(canSum, this.props.metadata.attributes[attributeName].type))
                    .map(attributeName => <tr key={`aggregate_sum_${entityName}_${attributeName}`} >
                        <td/>
                        <td style={style.attributeName} >{"sum of " + attributeName}</td>
                        <td/>
                        <td/>
                        <td><Input
                            type="radio"
                            name="x"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("x", attributeName, entityName, "sum")}
                        /></td>
                        <td><Input
                            type="radio"
                            name="y"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("y", attributeName, entityName, "sum")}
                        /></td>
                        <td><Input
                            type="radio"
                            name="z"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("z", attributeName, entityName, "sum")}
                        /></td>
                    </tr>)
                ;
            let rowsAvg = attributeNames
                    .filter(attributeName => _.includes(canSum, this.props.metadata.attributes[attributeName].type))
                    .map(attributeName => <tr key={`aggregate_avg_${entityName}_${attributeName}`} >
                        <td/>
                        <td style={style.attributeName} >{"average " + attributeName}</td>
                        <td/>
                        <td/>
                        <td><Input
                            type="radio"
                            name="x"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("x", attributeName, entityName, "avg")}
                        /></td>
                        <td><Input
                            type="radio"
                            name="y"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("y", attributeName, entityName, "avg")}
                        /></td>
                        <td><Input
                            type="radio"
                            name="z"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("z", attributeName, entityName, "avg")}
                        /></td>
                    </tr>)
                ;
            //TODO: could do min currency and float as well
            let rowsMin = attributeNames
                    .filter(attributeName => this.props.metadata.attributes[attributeName].type === "datetime")
                    .map(attributeName => <tr key={`aggregate_min_${entityName}_${attributeName}`} >
                        <td/>
                        <td style={style.attributeName} >{"earliest " + attributeName}</td>
                        <td/>
                        <td/>
                        <td><Input
                            type="radio"
                            name="x"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("x", attributeName, entityName, "min")}
                        /></td>
                        <td><Input
                            type="radio"
                            name="y"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("y", attributeName, entityName, "min")}
                        /></td>
                        <td><Input
                            type="radio"
                            name="z"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("z", attributeName, entityName, "min")}
                        /></td>
                    </tr>)
                ;
            let rowsMax = attributeNames
                    .filter(attributeName => this.props.metadata.attributes[attributeName].type === "datetime")
                    .map(attributeName => <tr key={`aggregate_max_${entityName}_${attributeName}`} >
                        <td/>
                        <td style={style.attributeName} >{"latest " + attributeName}</td>
                        <td/>
                        <td/>
                        <td><Input
                            type="radio"
                            name="x"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("x", attributeName, entityName, "max")}
                        /></td>
                        <td><Input
                            type="radio"
                            name="y"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("y", attributeName, entityName, "max")}
                        /></td>
                        <td><Input
                            type="radio"
                            name="z"
                            wrapperClassName="col-xs-offset-2 col-xs-10"
                            onChange={event => this.setAggregate("z", attributeName, entityName, "max")}
                        /></td>
                    </tr>)
                ;
            rows = rows
                .concat(rowsSum)
                .concat(rowsAvg)
                .concat(rowsMin)
                .concat(rowsMax)
            ;
        }

        rows.unshift(entityRow);
        return rows;
    };

    getRelationshipDetail = (precursor, name, successor) => {
        let up = true;
        let count = 0;
        let relationship = this.props.metadata.relationships[name];
        for (let shape of relationship.shapes) {
            if ((shape.from === precursor) && (shape.to === successor)) {
                up = false;
                count = shape.count;
                break;
            }
            if ((shape.from === successor) && (shape.to === precursor)) {
                up = true;
                count = shape.count;
                break;
            }
        }

        let style = {
            backgroundColor: "whitesmoke"
        };

        return <tr key={`relationship_${precursor}_${name}_${successor}`} style={style} >
            <td><Glyphicon glyph={up ? "arrow-up" : "arrow-down"} bsSize="xsmall" /></td>
            <td>{name}</td>
            <td>{count}</td>
            <td/>
            <td/>
            <td/>
            <td/>
        </tr>;
    };

    setSubject = (subject, i) => {
        let detail = {
            subject,
            i,
            x: null,
            y: null,
            z: null
        };
        this.setState({ detail });
    };

    setAttribute = (dimension, name) => {
        let detail = this.state.detail;
        detail[dimension] = {
            name,
            agg: null
        };
        this.setState({ detail });
    };

    setAggregate = (dimension, attribute, entity, f="sum") => {
        let detail = this.state.detail;

        // Get path as the section of queryPath between the subject and destination, exclusively.
        let queryPath = this.props.queryPath;
        let iStart = queryPath.findIndex(d => d === this.state.detail.subject);
        let iEnd = queryPath.findIndex(d => d === entity);
        if ((iStart < 0) || (iEnd < 0) || (iStart === iEnd)) return;
        let path = [];
        if (iStart < iEnd) {
            path = queryPath.slice(iStart + 1, iEnd);
        }
        else {
            let reverse = queryPath.slice().reverse();
            path = reverse.slice( -iStart, -iEnd - 1);
        }

        detail[dimension] = {
            name: `${f} of ${attribute} for ${entity} (${path.join(", ")})`,
            agg: {
                attribute,
                entity,
                f,
                path
            }
        };
        this.setState({ detail });
    };

    toggleDetails = () => {
        this.setState({ showDetail: !this.state.showDetail });
    };

    makeNewScatterPlot = () => {
        let config = {
            entity: this.state.detail.subject,
            assignment: {
                x: this.state.detail.x,
                y: this.state.detail.y,
                z: this.state.detail.z
            }
        };
        this.props.actionCreateInstrument("scatter", config)
    };
}


class News extends Component {
    //TODO: Could probably be done in a more pure React way, with no d3.

    static defaultProps = {
        //url: "http://www.abc.net.au/news/feed/45910/rss.xml",     // Top stories
        //url: "http://www.abc.net.au/news/feed/1534/rss.xml",      // Politics
        //url: "http://www.abc.net.au/local/rss/all.xml",        // All local
        interval: 600000,
        maxArticles: 20
    };

    constructor(props) {
        super(props);
        this.state = {
            //entity: "OrgPosition",
            //entity: "Region",
            //entity: "Location",
            feed: null,
            tags: []
        };

        // Fetch the Region hierarchy to build the tag search list
        //TODO: add a config to choose which entity type to search, including non-hierarchy
        //this.getTags();

        this.loadStream();
        this.timerId = setInterval(this.loadStream, this.props.interval);
    }

    shouldComponentUpdate(nextProps, nextState) {
        return (nextProps.instrument.mode !== this.props.instrument.mode)
            || (nextState !== this.state)
        ;
    }

    componentWillUnmount() {
        clearInterval(this.timerId);
    }

    render() {
        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
            case "load":
                // Show loading progress component.
                return <ProgressBar active now={100} label={"%(percent)s%"}>
                </ProgressBar>;
            default:
                // Normal mode, showing the feed.
                if (!this.state.feed) return <div>No feed found</div>;

                let headlines = this.state.feed
                    .map(({ title, summary, image, link, guid }) => {
                        let tags = this.getTags(title);
                        return {
                            title,
                            summary,
                            image,
                            link,
                            tags,
                            guid
                        }
                    })
                ;
                return <Accordion
                    onSelect={this.getTagsForItem}
                    style={{
                        overflowY: "scroll"
                    }}
                >
                    {this.getFeedItems(headlines)}
                </Accordion>;
        }
    }

    getFeedItems = items => {

        let style = {
            tag: {
                cursor: "pointer"
            }
        };
        return items.map(item => <Panel
            key={item.guid}
            eventKey={item.title}
            header={item.title}
            >
            <div>{item.tags.map(tag =>
                    <Badge
                        key={tag.text}
                        onClick={event => this.props.actionFetchSelection(tag.ids)}
                        style={style.tag}
                        >
                        {tag.text}
                    </Badge>
            )}</div>
            <div>
                {item.summary}
            </div>
            <div>
                <img src={item.image.url}/>
            </div>
        </Panel>);
    };

    loadStream = () => {
        this.props.actionSetMode(this.props.instrument.id, "load");

        let url = `http://localhost:3000/feed/${this.props.maxArticles}`;
        fetch(url)
            .then(response => response.json())
            .then(feed => {
                //TODO: add progress to the loader, perhaps using oboe.js to stream the load.
                this.setState({ feed });
                this.props.actionSetMode(this.props.instrument.id, "grid");
            })
        ;
    };

    getTagsForItem = title => {
        let searchText = title
            .replace(/[^\w\s]|_/g, " ")      // Remove anything not alphanumeric or whitespace
            .replace(/\s+/g, " ")           // Collapse whitespace
        ;

        //TODO: use string attributes, as available
        let url = `http://localhost:3000/nodes-in-text?a=pretty&a=name&text=${encodeURIComponent(searchText)}`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                //TODO: add progress to the loader, perhaps using oboe.js to stream the load.
                let tags = [];
                data.forEach(node => {
                    let text = node.text;
                    let tag = _.find(tags, { text });
                    if (!tag) {
                        tags.push({
                            text,
                            ids: [node.id]
                        });
                    }
                    else {
                        tag.ids.push(node.id);
                    }
                });

                this.setState({
                    tags
                });
            })
        ;
    };

    getTags = text => {
        // Look for words/terms that match selectable entities, and wrap them in spans that
        // create a selection when clicked.
        //TODO: probably better to highlight matches only, and put a list of clickable tags under the heading div
        let found = [];
        for (let tag of this.state.tags) {
            // Match the tag text with no neighbouring letters of numbers.
            let re = new RegExp("\\b(" + _.escapeRegExp(tag.text) + ")\\b", "i");
            if (re.test(text)) {
                found.push(tag);
            }
        }
        return found;
    };
}


class Map2d extends Component {
    // Leverage the nice feature set of google-map-react, which allows a lot of customised behaviour

    static defaultProps = {
        centre: [-25.982, 133.951],
        zoom: 3
    };

    constructor(props) {
        super(props);

        //let entity;
        try {
            let validEntities = _.pickBy(
                props.metadata.entities,
                d => _.includes(d.attributes, "geo_poly") || _.includes(d.attributes, "geo_point")
            );

            // Entity may be provided in config prop, or get it from metadata
            if (props.instrument.config && props.instrument.config.entity && validEntities[props.instrument.config.entity]) {
                this.state = {
                    validEntities,
                    //entity,
                    locations: []
                };

                this.getLocations(this.props.selected.concat(this.props.related));
            }
            else {
                this.state = {
                    validEntities,
                    locations: []
                };

                this.props.actionSetConfig(this.props.instrument.id, {
                    entity: _.keys(validEntities)[0]
                });
            }
        }
        catch(e) {
            console.log(e);
            this.props.actionSetMode(this.props.instrument.id, "error");
            //TODO: error action
        }
    }

    componentWillReceiveProps(nextProps) {
        if ((nextProps.selected !== this.props.selected) || (nextProps.related !== this.props.related)) {
            this.getLocations(nextProps.selected.concat(nextProps.related));
        }
    }

    componentDidUpdate() {
        var map = ReactDOM.findDOMNode(this.refs.map);
        if (map) window.google.maps.event.trigger(map, "resize");
    }

    render() {
        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            case "load":
                // Show loading progress component.
                return <ProgressBar active now={100} label={"%(percent)s%"}>
                </ProgressBar>;
                break;
            case "config":
                // Show a config form.
                let entities = _.keys(this.state.validEntities);
                return <form>
                    <Input
                        ref="selectEntity"
                        type="select"
                        label="Entity type:"
                        defaultValue={this.props.instrument.config.entity}
                        onChange={() => this.props.actionSetConfig(this.props.instrument.id, {entity: this.refs.selectEntity.getValue()})}
                    >
                        {entities.map(d =>
                            <option key={d} value={d}>
                                {d}
                            </option>
                        )}
                    </Input>
                    <ButtonInput
                        value="Show Map"
                        onClick={() => {
                            this.getLocations(this.props.selected.concat(this.props.related));
                        }}
                        disabled={!this.props.instrument.config.entity}
                    />
                </form>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                // Normal mode, showing the map.
                return <section style={{height: "100%"}}><GoogleMap
                    containerProps={{
                        style: {
                            height: "100%"
                        }
                    }}
                    ref="map"
                    defaultZoom={3}
                    defaultCenter={this.getCenter()}
                >
                    {this.getMarkers()}
                </GoogleMap></section>;
        }
    }


    getLocations = (ids = []) => {
        let entity = this.props.instrument.config.entity;
        this.props.actionSetEntities(this.props.instrument.id, [entity]);
        this.props.actionSetTitle(this.props.instrument.id, entity);

        let url = `http://localhost:3000/entity-points-by-id/${entity}?ids=` + ids.join(",");
        fetch(url)
            .then(response => response.json())
            .then(json => {
                //TODO: add progress to the loader, perhaps using oboe.js to stream the load.
                /*
                    json is like [{_id:id, attr1:val1, attr2:val2,... },...]
                 */
                // Location is taken from geo_point, or if not available then the average from geo_poly
                // TODO: Properly draw geo_poly on map
                let locations = json.map(d => {
                    let position = [0, 0];
                    if (d.geo_point) {
                        position = d.geo_point;
                    }
                    else if (d.geo_poly) {
                        let points = _.chunk(d.geo_poly, 2);
                        let pointSum = points.reduce((acc, d) => [acc[0] + d[0], acc[1] + (d[1] || 0)], [0, 0]);
                        position = [pointSum[0] / points.length, pointSum[1] / points.length];
                    }
                    return {
                        position,
                        name: d.name,
                        id: d._id
                    };
                });

                this.setState({ locations });

                this.props.actionSetMode(this.props.instrument.id, "grid");
            })
        ;
    };

    getCenter = () => {
        // If we have selections, center somewhere between them. Otherwise use the prop.
        let pointSum = this.state.locations.reduce(
            (acc, d) => [acc[0] + (d.position[0] || 0), acc[1] + (d.position[1] || 0)],
            [0, 0]
        );
        return {
            lat: (pointSum[0] / this.state.locations.length) || this.props.centre[0],
            lng: (pointSum[1] / this.state.locations.length) || this.props.centre[1]
        };
    };

    getMarkers = () => {
        return this.state.locations.map((location, i) =>
            <Marker
                key={i}
                title={location.name}
                position={{lat: location.position[0], lng: location.position[1]}}
                onClick={() => this.props.actionFetchSelection([location.id])}
                opacity={_.includes(this.props.selected, location.id) ? 1.0 : 0.5}
            />)
        ;
    };
}


class Filler extends Component {
    // Debugging instrument, just loads after an interval.

    componentDidMount() {
        setTimeout(() => this.props.actionSetMode(this.props.instrument.id, "grid"), 3000);
    }

    render() {
        const style = {
            svg: {
                position: "absolute",
                strokeWidth: "1",
                stroke: "red"
            },
            text: {
                height: "100%",
                width: "100%",
                position: "absolute",
                overflowY: "scroll"
            }
        };

        return <div>
            <svg className="chart content-fix" style={style.svg} width={this.props.width} height={this.props.height}>
                <rect  />
                <line x1="0" y1="0" x2="100%" y2="100%" />
                <line x1="100%" y1="0" x2="0" y2="100%" />
            </svg>
            <div style={style.text}>{JSON
                .stringify(this.props, null, "____")
                .split("\n")
                .map(line => <p>{line}</p>)
            }</div>
        </div>;
    }
}


class Notes extends Component {
    // List details for the selected (and related) entities.

    constructor(props) {
        super(props);
        this.state = {
            notes: [],
            focused: null,
            openCreation: false,
            validNote: false
        };

        this.fetchDetails();
    }

    render() {
        let style = {
            container: {
                display: "flex",
                flexFlow: "column",
                height: "100%"
            },
            control: {
                flex: "0 1 auto"
            },
            add: {
                flex: "0 1 auto"
            },
            list: {
                flex: "1 1 auto",
                overflowY: "scroll"
            }
        };

        return <div style={style.container}>
            <Modal show={this.state.openCreation} onHide={this.toggleCreation}>
                <Modal.Header closeButton>
                    <Modal.Title>Create New Note</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Input
                        addonBefore="Title"
                        ref="newName"
                        type="text"
                        onChange={this.validateNote}
                    />
                    <Input
                        ref="newDescription"
                        type="text"
                        addonBefore="Description"
                        bsSize="small"
                    />
                    <Button
                        onClick={event => this.addNote()}
                        disabled={!this.state.validNote}
                    >Create</Button>
                </Modal.Body>
            </Modal>
            <Well bsSize="small">
                <ButtonToolbar>
                    <ButtonGroup bsSize="small">
                        <Button
                            onClick={this.toggleCreation}
                        >Create Note</Button>
                        <Button
                            disabled={!this.state.focused}
                            onClick={event => this.deleteNote()}
                        >Delete Note</Button>
                    </ButtonGroup>
                    <ButtonGroup bsSize="small">
                        <Button
                            disabled={!this.state.focused}
                            onClick={event => this.addToSelection()}
                        >+ Selection</Button>
                        <Button
                            disabled={!this.state.focused}
                            onClick={event => this.subtractFromSelection()}
                        >- Selection</Button>
                        <Button
                            onClick={event => this.showSelection()}
                        >Load Selection</Button>
                    </ButtonGroup>
                    <ButtonGroup bsSize="small">
                        <Button
                            disabled={!this.state.focused}
                            onClick={event => this.saveView()}
                        >Save View</Button>
                        <Button
                            disabled={!this.state.focused}
                            onClick={event => this.loadView()}
                        >Load View</Button>
                    </ButtonGroup>
                    <ButtonGroup bsSize="small">
                        <Button
                            disabled={!this.state.focused}
                            onClick={event => this.savePath()}
                        >Save Path</Button>
                        <Button
                            disabled={!this.state.focused}
                            onClick={event => this.loadPath()}
                        >Load Path</Button>
                    </ButtonGroup>
                </ButtonToolbar>
            </Well>
            <Accordion style={style.list}>{this.getNotes()}</Accordion>
        </div>;
    }


    toggleCreation = () => {
        this.setState({
            openCreation: !this.state.openCreation
        });
    };

    validateNote = () => {
        this.setState({
            validNote: this.refs.newName.getValue().length > 0
        });
    };

    fetchDetails = () => {
        let url = "http://localhost:3000/get-notes";
        fetch(url)
            .then(response => response.json())
            .then(notes => {
                this.setState({ notes });
                this.props.actionSetMode(this.props.instrument.id, "grid");
            })
        ;
    };

    getNotes = () => {
        return this.state.notes.map(d =>
            <Panel
                key={d.id}
                eventKey={d.id}
                header={d.name}
                bsStyle={
                    ((d === this.state.focused) && "primary")
                    || (_.intersection(d.selection, this.props.selected).length && "info")
                    || "default"
                }
                onClick={event => this.setFocus(d)}
            >
                <p>{d.description}</p>
            </Panel>
        );
    };

    setFocus = note => {
        this.setState({
            focused: note
        })
    };


    //TODO: These write operations should affect dataStore so all instruments can update.

    addNote = () => {
        // Just make an empty note
        let name = JSON.stringify(encodeURIComponent(this.refs.newName.getValue()));
        let description = JSON.stringify(encodeURIComponent(this.refs.newDescription.getValue()));
        let selection = JSON.stringify(this.props.selected);
        let view = JSON.stringify(this.props.view);
        let path = encodeURIComponent(this.props.queryPath);
        let tree = encodeURIComponent(this.props.queryTree);
        let url = `http://localhost:3000/create-note?name=${name}&description=${description}&selection=${selection}&view=${view}&path=${path}`;
        fetch(url)
            .then(response => response.json())
            .then(json => {
                this.fetchDetails();
            })
        ;
    };

    deleteNote = () => {
        if (!this.state.focused) return;
        let id = this.state.focused.id;

        let url = `http://localhost:3000/delete-note/${id}`;
        fetch(url)
            .then(response => response.json())
            .then(json => {
                this.fetchDetails();
            })
        ;
    };

    addToSelection = () => {
        if (!this.state.focused) return;

        let activeSelection = this.props.selected;
        let noteSelection = this.state.focused.selection;

        this.updateNoteSelection(_.union(noteSelection, activeSelection));
    };

    subtractFromSelection = () => {
        if (!this.state.focused) return;

        let activeSelection = this.props.selected;
        let noteSelection = this.state.focused.selection;

        this.updateNoteSelection(_.difference(noteSelection, activeSelection));
    };

    updateNoteSelection = selection => {
        if (!this.state.focused) return;
        let id = this.state.focused.id;

        let url = `http://localhost:3000/update-note-selection/${id}?s=${JSON.stringify(selection)}`;
        fetch(url)
            .then(response => response.json())
            .then(json => {
                this.fetchDetails();
            })
        ;
    };

    showSelection = () => {
        if (!this.state.focused) return;
        this.props.actionFetchSelection(this.state.focused.selection);
    };

    saveView = () => {
        // Save to the note's view property, a JSON representation of data needed to reproduce layout.
        // I.e. layout.config, layout.grid (except i, allocated on load?), layout.type.

        if (this.state.focused) this.props.actionSaveView(this.state.focused.id);
    };

    loadView = () => {
        let url = location.href.split("?", 1)[0];
        location.href = url + "?viewId=" + this.state.focused.id;
    };

    savePath = () => {
        if (!this.state.focused) return;
        let id = this.state.focused.id;

        let url = `http://localhost:3000/update-note-path/${id}?path=${encodeURIComponent(this.props.queryPath)}`;
        fetch(url)
            .then(response => response.json())
            .then(json => {
                //this.fetchDetails();
            })
        ;
    };

    loadPath = () => {
        if (!this.state.focused) return;
        let newPath = (this.state.focused.path && this.state.focused.path.split(",")) || [];
        this.props.actionSetQueryPath(newPath);
    };
}


class ListSelected extends Component {
    // List details for the selected (and related) entities.

    constructor(props) {
        super(props);
        this.state = {
            detail: {
                selected: [],
                related: []
            }
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.selected !== this.props.selected) this.fetchDetails(nextProps.selected, "selected");
        if (nextProps.related !== this.props.related) this.fetchDetails(nextProps.related, "related");
    }

    componentDidMount() {
        this.fetchDetails(this.props.selected, "selected");
        this.fetchDetails(this.props.related, "related");
    }

    render() {
        let style = {
            "overflowY": "scroll",
            "height": "100%"
        };

        return <div style={style}>
            <Panel key="selected" header="Selected" >
                {this.getDetailComponents("selected")}
            </Panel>
            <Panel key="related" header="Related" >
                {this.getDetailComponents("related")}
            </Panel>
        </div>;
    }

    fetchDetails = (ids, tag) => {
        // Fetch details for the selected and related ids.
        let detail = this.state.detail;

        if (!ids.length) {
            detail[tag] = [];
            this.setState({ detail });
            return;
        }

        let url = `http://localhost:3000/points-by-id?ids=` + ids.join(",");
        fetch(url)
            .then(response => response.json())
            .then(json => {
                detail[tag] = json;
                console.log(json);
                this.setState({ detail });
            })
        ;
    };

    getForEntity = ({entity, attributes, points, ids}) => {
        return <Table responsive striped hover>
            <thead><tr>
                {attributes.map(d => <th>{d}</th>)}
                <th><ButtonInput
                    onClick={event => this.props.actionFetchSelection(ids)}
                >Select</ButtonInput></th>
            </tr></thead>
            <tbody>{
                points.map((p, i) => <tr key={i}>
                    {attributes.map((a, i) => <td>{String(p[i])}</td>)}
                </tr>)
                }</tbody>
        </Table>;
    };

    getDetailComponents = tag => {
        if (this.state.detail[tag].length < 1) return `Nothing ${tag}...`;

        return <Accordion>{
            this.state.detail[tag].map(d =>
                <Panel
                    key={d.entity}
                    eventKey={d.entity}
                    header={<span>
                        <span style={{ color: this.props.metadata.entities[d.entity].colour || "black" }} >⬤</span>
                        <span>{" " + d.entity}</span>
                    </span>}
                >
                    {this.getForEntity(d)}
                </Panel>
            )
        }</Accordion>;
    };
}


class ListEntity extends Component {
    // List details for the chosen entity.

    constructor(props) {
        super(props);

        let entity;
        try {
            // Entity may be provided in config prop, or get it from metadata
            if (props.instrument.config && props.instrument.config.entity) {
                entity = props.instrument.config.entity;
            }
            else {
                entity = _.keys(props.metadata.entities)[0];
            }

            this.state = {
                entity,
                detail: []
            };
        }
        catch(e) {
            console.log(e);
            this.props.actionSetMode(this.props.instrument.id, "error");
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        // Only if the mode has changed, and maybe the state later...
        return nextProps.mode !== this.props.mode;
    }

    render() {
        let style = {
            "overflowY": "scroll",
            "height": "100%"
        };

        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            case "load":
                // Show loading progress component.
                return <ProgressBar active now={100} label={"%(percent)s%"}>
                </ProgressBar>;
                break;
            case "config":
                // Show a config form.
                let entities = _.keys(this.props.metadata.entities);
                return <form>
                    <Input
                        ref="selectEntity"
                        type="select"
                        label="Entity type:"
                        defaultValue={this.state.entity}
                        onChange={() => {
                            let entity = this.refs.selectEntity.getValue();
                            this.setState({
                                entity
                            })
                        }}
                    >
                        {entities.map((d, i) =>
                            <option key={i} value={d}>
                                {d}
                            </option>
                        )}
                    </Input>
                    <ButtonInput
                        value="List"
                        onClick={this.fetchDetails}
                        disabled={!this.state.entity}
                    ></ButtonInput>
                </form>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                return <div style={style}>
                    {this.getDetailComponents()}
                </div>;
        }
    }

    fetchDetails = () => {
        // Fetch details for the selected and related ids.
        this.props.actionSetMode(this.props.instrument.id, "load");
        this.props.actionSetEntities(this.props.instrument.id, [this.state.entity]);
        this.props.actionSetTitle(this.props.instrument.id, this.state.entity);

        let url = `http://localhost:3000/entity-all/` + this.state.entity;
        fetch(url)
            .then(response => response.json())
            .then(detail => {
                this.setState({ detail });
                this.props.actionSetMode(this.props.instrument.id, "grid");
            })
        ;
    };

    getDetailComponents = () => {
        if (this.state.detail.length < 1) return "Nothing here...";

        //TODO: add highlighting of selected

        let attributes = new Set();
        let points = [];
        this.state.detail.forEach(d => {
            for (let key of _.keys(d)) attributes.add(key);
            points.push
        });
        let headers = [];
        for (let a of attributes.keys()) headers.push(a);

        return <Table responsive striped hover>
            <thead><tr>{headers.map(d => <th>{d}</th>)}</tr></thead>
            <tbody>{
                this.state.detail.map(d => <tr>
                    {headers.map(h => <td>{String(d[h])}</td>)}
                    <td><ButtonInput
                        onClick={event => this.props.actionFetchSelection([d._id])}
                        >Select</ButtonInput></td>
                </tr>)
            }</tbody>
        </Table>;
    };
}


class ScatterPlot extends Component {
    constructor(props) {
        super(props);

        try {
            // Entity may be provided in config prop, or get it from metadata
            if (props.instrument.config.entity && props.instrument.config.assignment) {
                this.state = {
                    dimensions: [],
                    points: []
                };
            }
            else {
                let entity = _.keys(props.metadata.entities)[0];
                let dimensions = this.getDimensionsForEntity(entity);
                let assignment = {
                    x: dimensions[0] || null,
                    y: dimensions[1] || dimensions[0] || null,
                    z: dimensions[2] || dimensions[1] || dimensions[0] || null
                };

                this.state = {
                    dimensions,
                    points: []
                };

                this.props.actionSetConfig(this.props.instrument.id, {
                    entity,
                    assignment
                });
            }
        }
        catch(e) {
            console.log(e);
            this.props.actionSetMode(this.props.instrument.id, "error");
            //TODO: error action
        }
    }

    componentDidMount() {
        if (this.props.instrument.config.entity && this.props.instrument.config.assignment) {
            this.getGraphData();
        }
    }

    componentDidUpdate() {
        let chart = ReactDOM.findDOMNode(this.refs.chart);
        if (!chart) return;

        let gAxisX = ReactDOM.findDOMNode(this.refs.axisX);
        let gAxisY = ReactDOM.findDOMNode(this.refs.axisY);
        let gBrushX = ReactDOM.findDOMNode(this.refs.brushX);
        let gBrushY = ReactDOM.findDOMNode(this.refs.brushY);
        let canvasPlot = ReactDOM.findDOMNode(this.refs.plot);
        let svgAntiPlot = ReactDOM.findDOMNode(this.refs.anti);

        // For first version, just plot everything available. Zoom, extent config can come later.

        let config = this.props.instrument.config;

        const
            OFFSET = 50,
            POINT_SIZE = 6,
            WIDTH = this.props.width - OFFSET,
            HEIGHT = this.props.height - OFFSET,
            NEAR = 0.1,
            FAR = Math.max(WIDTH, HEIGHT) * 2,
            ASPECT = WIDTH / HEIGHT,
            DATA = this.state.points,
            STYLE = {
                text: {
                    "stroke": "none",
                    "fill": "black"
                }
            },
            DX = config.assignment.x,
            DY = config.assignment.y,
            DZ = config.assignment.z,
            ATTRIBUTES = this.props.metadata.attributes,
            META_X = !DX.agg ? ATTRIBUTES[DX.name] : ATTRIBUTES[DX.agg.attribute],
            META_Y = !DY.agg ? ATTRIBUTES[DY.name] : ATTRIBUTES[DY.agg.attribute],
            META_Z = !DZ.agg ? ATTRIBUTES[DZ.name] : ATTRIBUTES[DZ.agg.attribute],
            COLOUR_NORMAL = new three.Color(0x4682b4),
            COLOUR_SELECTED = new three.Color(0xff0000),
            COLOUR_RELATED = new three.Color(0xff4500)
        ;

        if (!this.renderer) {
            // Set up plot with three.js
            this.renderer = new three.WebGLRenderer({
                canvas: canvasPlot,
                antialias: false
            });
            this.camera = new three.OrthographicCamera(
                0,
                WIDTH,
                HEIGHT,
                0,
                NEAR,
                FAR
            );
            this.camera.position.z = 10;
        }

        this.camera.right = WIDTH;
        this.camera.top = HEIGHT;
        this.camera.aspect = ASPECT;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(WIDTH, HEIGHT);
        this.renderer.setClearColor(0xffffff);
        this.scene = new three.Scene();
        this.scene.add(this.camera);

        let material = new three.PointsMaterial({
            vertexColors: three.VertexColors,
            //blending: three.MultiplyBlending,
            transparent: true,
            opacity: 0.5,
            size: POINT_SIZE,
            sizeAttenuation: false
        });
        this.geometry = new three.Geometry;
        this.geometry.dynamic = true;
        let particles = new three.Points(this.geometry, material);
        this.scene.add(particles);

        // Update scales
        let scaleX, scaleY, scaleZ;
        switch (META_X.type) {
            case "currency":
                scaleX = d3.scale.linear()
                    .domain(d3.extent(DATA, d => d.x))
                    .range([0, WIDTH])
                ;
                break;
            case "integer":
            case "float":
                scaleX = d3.scale.linear()
                    .domain(d3.extent(DATA, d => d.x))
                    .range([0, WIDTH])
                ;
                break;
            case "string":
                scaleX = d3.scale.ordinal()
                    .domain(DATA.map(d => d.x))
                    .rangeRoundPoints([0, WIDTH], 1)
                    // Needs a custom invert()      TODO: Restrict this instrument to linear attribute types
                ;
                break;
            case "datetime":
                // "object", i.e. datetime
                scaleX = d3.time.scale()
                    .domain(d3.extent(DATA, d => d.x))
                    .range([0, WIDTH])
                ;
                break;
            default:    // "vector2d", "poly2d" not supported in scatter plot
                scaleX = d => null;
                scaleX.range = d => null;
        }
        switch (META_Y.type) {
            case "currency":
                scaleY = d3.scale.linear()
                    .domain(d3.extent(DATA, d => d.y))
                    .range([HEIGHT, 0])
                ;
                break;
            case "integer":
            case "float":
                scaleY = d3.scale.linear()
                    .domain(d3.extent(DATA, d => d.y))
                    .range([HEIGHT, 0])
                ;
                break;
            case "string":
                scaleY = d3.scale.ordinal()
                    .domain(DATA.map(d => d.y))
                    .rangeRoundPoints([HEIGHT, 0], 1)
                    // Needs a custom invert()
                ;
                break;
            case "datetime":
                // "object", i.e. datetime
                scaleY = d3.time.scale()
                    .domain(d3.extent(DATA, d => d.y))
                    .range([HEIGHT, 0])
                ;
                break;
            default:    // "vector2d", "poly2d" not supported in scatter plot
                scaleY = d => null;
                scaleY.range = d => null;
        }
        switch (META_Z.type) {
            case "currency":
                scaleZ = d3.scale.linear()
                    .domain(d3.extent(DATA, d => d.z))
                    .range([0, 1])
                ;
                break;
            case "integer":
            case "float":
                scaleZ = d3.scale.linear()
                    .domain(d3.extent(DATA, d => d.z))
                    .range([0, 1])
                ;
                break;
            case "string":
                scaleZ = d3.scale.ordinal()
                    .domain(DATA.map(d => d.z))
                    .rangeRoundPoints([0, 1], 1)
                    // Needs a custom invert()
                ;
                break;
            case "datetime":
                // "object", i.e. datetime
                scaleZ = d3.time.scale()
                    .domain(d3.extent(DATA, d => d.z))
                    .range([0, 1])
                ;
                break;
            default:    // "vector2d", "poly2d" not supported in scatter plot
                scaleZ = d => null;
                scaleZ.range = d => null;
        }

        let brushX = d3.svg.brush()
            .x(scaleX)
            .on("brushend", () => console.log("X"))
        ;
        let brushY = d3.svg.brush()
            .y(scaleY)
            .on("brushend", () => console.log("Y"))
        ;

        // Update axes
        const FORMAT_CURRENCY = d3.format("$,s");       //TODO: Keep a format string on the metadata, and use it here
        const FORMAT_FLOAT = d3.format(",.3s");
        const FORMAT_INTEGER = d3.format(",s");
        let axisX = d3.svg.axis()
            .scale(scaleX)
            .orient("bottom")
        ;
        let axisY = d3.svg.axis()
            .scale(scaleY)
            .orient("left")
        ;
        switch (META_X.type) {
            case "currency":
                axisX.tickFormat(FORMAT_CURRENCY);
                break;
            case "float":
                axisX.tickFormat(FORMAT_FLOAT);
                break;
            case "integer":
                axisX.tickFormat(FORMAT_INTEGER);
                break;
        }
        switch (META_Y.type) {
            case "currency":
                axisY.tickFormat(FORMAT_CURRENCY);
                break;
            case "float":
                axisY.tickFormat(FORMAT_FLOAT);
                break;
            case "integer":
                axisY.tickFormat(FORMAT_INTEGER);
                break;
        }
        d3.select(gAxisX)
            .call(axisX)
            .selectAll("g.tick text")
            .style(STYLE.text)
        ;
        d3.select(gAxisY)
            .attr("transform", () => `translate(${OFFSET} 0)`)
            .call(axisY)
            .selectAll("g.tick text")
            .style(STYLE.text)
        ;

        // Update brushes
        let brush = d3.select(gBrushX).call(brushX);
        brush.selectAll("rect")
            .attr("height", OFFSET)
        ;
        brush.selectAll(".extent")
            .style({
                "opacity": 0.3
            })
        ;
        brush = d3.select(gBrushY).call(brushY);
        brush.selectAll("rect")
            .attr("width", OFFSET)
        ;
        brush.selectAll(".extent")
            .style({
                "opacity": 0.3
            })
        ;

        // Determine which of the points are in the current selection
        this.setOfSelected = new WeakSet(DATA.filter(d => _.includes(this.props.selected, d.id)));
        // Determine which of the points are related to the selection
        this.setOfRelated = new WeakSet(DATA.filter(d => _.includes(this.props.related, d.id)));

        // Update all the three.js stuff
        this.geometry.vertices = DATA.map(d => new three.Vector3(
            scaleX(d.x) || 0,
            (HEIGHT - scaleY(d.y)) || 0,
            scaleZ(d.z) || 0
        ));
        this.geometry.colors = DATA.map((d, i) => {
            if (this.setOfSelected.has(d)) return COLOUR_SELECTED;
            if (this.setOfRelated.has(d)) return COLOUR_RELATED;
            return COLOUR_NORMAL.clone().offsetHSL(this.geometry.vertices[i].z * -0.2, 0, 0);
        });

        this.geometry.colorsNeedUpdate = true;
        this.geometry.verticesNeedUpdate = true;

        // Update dimensions and render
        this.renderer.render(this.scene, this.camera);

        // Listen for clicks, so we do selections
        canvasPlot.onclick = e => {
            let xMin = scaleX.invert(e.offsetX - POINT_SIZE);
            let yMin = scaleY.invert(e.offsetY + POINT_SIZE);
            let xMax = scaleX.invert(e.offsetX + POINT_SIZE);
            let yMax = scaleY.invert(e.offsetY - POINT_SIZE);
            if (META_X.type === "datetime") {
                xMin = xMin.getTime();
                xMax = xMax.getTime();
            }
            if (META_Y.type === "datetime") {
                yMin = yMin.getTime();
                yMax = yMax.getTime();
            }
            let ids = DATA
                .filter(d => {
                    let x = d.x;
                    let y = d.y;
                    if ((x === null) || (y === null)) return false;

                    if (META_X.type === "datetime") {
                        x = x.getTime();
                    }
                    if (META_Y.type === "datetime") {
                        y = y.getTime();
                    }
                    return (x >= xMin) &&
                        (x <= xMax) &&
                        (y >= yMin) &&
                        (y <= yMax)
                    ;
                })
                .map(d => d.id)
            ;
            this.props.actionFetchSelection(ids);
        };
    }

    render() {
        const
            ORIGIN_OFFSET = 50,
            W = this.props.width,
            H = this.props.height,
            style = {
                chart: {
                    position: "absolute",
                    width: W,
                    height: H
                },
                x: {
                    position: "absolute",
                    width: W - ORIGIN_OFFSET,
                    height: ORIGIN_OFFSET,
                    left: ORIGIN_OFFSET,
                    top: H - ORIGIN_OFFSET,
                    overflow: "visible"
                },
                y: {
                    position: "absolute",
                    width: ORIGIN_OFFSET,
                    height: H - ORIGIN_OFFSET,
                    left: 0,
                    top: 0,
                    overflow: "visible"
                },
                plot: {
                    position: "absolute",
                    left: ORIGIN_OFFSET,
                    top: 0
                },
                anti: {
                    position: "absolute",
                    width: ORIGIN_OFFSET,
                    height: ORIGIN_OFFSET,
                    left: 0,
                    top: H - ORIGIN_OFFSET

                },
                zToY: {
                    position: "absolute",
                    width: ORIGIN_OFFSET / 2,
                    height: ORIGIN_OFFSET / 2,
                    left: 0,
                    top: 0
                },
                zToX: {
                    position: "absolute",
                    width: ORIGIN_OFFSET / 2,
                    height: ORIGIN_OFFSET / 2,
                    left: ORIGIN_OFFSET / 2,
                    top: ORIGIN_OFFSET / 2
                },
                z: {
                    position: "absolute",
                    width: ORIGIN_OFFSET / 2,
                    height: ORIGIN_OFFSET / 2,
                    left: 0,
                    top: ORIGIN_OFFSET / 2,
                    textAlign: "center"
                },
                axis: {
                    stroke: "black",
                    strokeWidth: 1,
                    fill: "none",
                    fontSize: "10px",
                    overflow: "visible"
                },
                labelX: {
                    //transform: `translate(1em ${ORIGIN_OFFSET})`,
                    stroke: "none",
                    fill: "black",
                    fontSize: "12px"
                },
                labelY: {
                    //transform: `rotate(90)`,
                    stroke: "none",
                    fill: "black",
                    fontSize: "12px"
                }
            }
        ;

        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            case "load":
                // Show loading progress component.
                return <ProgressBar active now={100} label={"%(percent)s%"}>
                </ProgressBar>;
                break;
            case "config":
                // Show a config form.
                let entities = _.keys(this.props.metadata.entities);
                let getDimensionInput = axis => {
                    if (!this.props.instrument.config.assignment) return null;
                    return <Input
                        ref={"select-" + axis}
                        type="select"
                        labelClassName="col-xs-3"
                        wrapperClassName="col-xs-8"
                        label={axis + " axis:"}
                        onChange={() => {
                            let assignment = this.props.instrument.config.assignment;
                            assignment[axis] = this.state.dimensions[this.refs["select-" + axis].getValue()];
                            this.props.actionSetConfig(this.props.instrument.id, { assignment });
                        }}
                    >
                        {this.state.dimensions.map((d, i) =>
                            <option key={i} value={i} selected={d === this.props.instrument.config.assignment[axis]}>
                                {d.name}
                            </option>
                        )}
                    </Input>
                };
                return <form className="form-horizontal">
                    <Input
                        ref="selectEntity"
                        type="select"
                        labelClassName="col-xs-3"
                        wrapperClassName="col-xs-8"
                        label="Entity type:"
                        defaultValue={this.state.entity}
                        onChange={() => {
                            let entity = this.refs.selectEntity.getValue();
                            let dimensions = this.getDimensionsForEntity(entity);
                            this.setState({
                                dimensions
                            });
                            this.props.actionSetConfig(this.props.instrument.id, {
                                entity,
                                assignment: {
                                    x: dimensions[0] || null,
                                    y: dimensions[1] || dimensions[0] || null,
                                    z: dimensions[2] || dimensions[1] || dimensions[0] || null
                                }
                            });
                        }}
                    >
                        {entities.map((d, i) =>
                            <option key={i} value={d}>
                                {d}
                            </option>
                        )}
                    </Input>
                    {["x", "y", "z"].map(getDimensionInput)}
                    <ButtonInput
                        wrapperClassName="col-xs-offset-1 col-xs-8"
                        value="Plot"
                        onClick={this.getGraphData}
                        disabled={!this.props.instrument.config.entity}
                    />
                </form>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                // Normal mode, showing the plot with what data we have.
                return <div ref="chart" style={style.chart}>
                    <svg style={style.y}>
                        <g ref="axisY" style={style.axis}></g>
                        <g style={style.labelY} transform={`rotate(90)`}>
                            <text>{this.props.instrument.config.assignment.y.name}</text>
                        </g>
                        <g ref="brushY"></g>
                    </svg>
                    <canvas ref="plot" style={style.plot}></canvas>
                    <div style={style.anti}>
                        <Button
                            onClick={event => this.swapZ("y")}
                            style={style.zToY}
                            bsSize="xsmall"
                        >
                            <Glyphicon glyph="triangle-top" bsSize="xsmall"/>
                        </Button>
                        <div style={style.z}>Z</div>
                        <Button
                            onClick={event => this.swapZ("x")}
                            style={style.zToX}
                            bsSize="xsmall"
                        >
                            <Glyphicon glyph="triangle-right" bsSize="xsmall"/>
                        </Button>
                    </div>
                    <svg style={style.x}>
                        <g ref="axisX" style={style.axis}></g>
                        <g style={style.labelX} transform={`translate(5 ${ORIGIN_OFFSET})`}>
                            <text>{this.props.instrument.config.assignment.x.name}</text>
                        </g>
                        <g ref="brushX"></g>
                    </svg>
                </div>;
        }
    }

    swapZ = newAxis => {
        const COLOUR_NORMAL = new three.Color(0x4682b4);

        let points = this.state.points;

        // Animate rotation by stretching depth in z to size of the dimension it will move to, then rotate the geometry.
        // Actually... for the first version, just interpolate positions.
        //TODO: Implement the 3D shape rotation version

        let scale = d3.scale.linear()
            .domain([0, 1])
            .range((newAxis === "x") ? [0, this.camera.right] : [0, this.camera.top])
        ;
        let pos0 = this.geometry.vertices.map(d => d[newAxis]);
        let pos1 = this.geometry.vertices.map(d => scale(d.z));
        let pos = d3.interpolateArray(pos0, pos1);
        let z0 = this.geometry.vertices.map(d => d.z);
        let z1 = this.geometry.vertices.map(d => scale.invert(d[newAxis]));
        let z = d3.interpolateArray(z0, z1);

        let context = this;

        function doFrame(t) {
            let _t = d3.ease("circle-in-out")(t);
            let pos_t = pos(_t);
            let z_t = z(_t);

            let i = context.state.points.length;
            while (i--) {
                let v = context.geometry.vertices[i];
                let c = context.geometry.colors[i];
                v[newAxis] = pos_t[i];
                v.z = z_t[i];

                if (!context.setOfSelected.has(points[i])) {
                    c.copy(COLOUR_NORMAL.clone().offsetHSL(v.z * -0.2, 0, 0));
                }
            }
            context.geometry.verticesNeedUpdate = true;
            context.geometry.colorsNeedUpdate = true;

            context.renderer.render(context.scene, context.camera);
        }

        let t0 = null;
        const DURATION = 500;
        function animate(timestamp) {
            if (!t0) t0 = timestamp;
            let t = Math.min(timestamp - t0, DURATION);
            doFrame(t / DURATION);
            if (t < DURATION) requestAnimationFrame(animate)
            else swapData();
        }
        requestAnimationFrame(animate);

        function swapData() {
            // After animated rotation is done, redraw for newly assigned axes

            let temp;
            let assignment = context.props.instrument.config.assignment;

            temp = assignment.z;
            assignment.z = assignment[newAxis];
            assignment[newAxis] = temp;

            // For each in state.points, swap point.z with point[newAxis].
            points.forEach(point => {
                temp = point.z;
                point.z = point[newAxis];
                point[newAxis] = temp;
            });

            // State change to make plot refresh.
            context.setState({
                points
            });
            context.actionSetConfig(this.props.instrument.id, {
                assignment
            });
        }
    };

    getDimensionsForEntity = entity => {
        let entityDetail = this.props.metadata.entities[entity];
        //TODO: add ranges to detail here
        return entityDetail.attributes
            .map(d => ({
                name: d,
                agg: null
            }))
            .concat(entityDetail.aggregates.map(d => ({
                name: `${d.f} of ${d.attribute} for ${d.entity} (${d.path.join(", ")})`,
                agg: d
            })))
        ;
    };

    getGraphData = () => {
        //TODO: add a way to set multiple layout changes together.
        let entity = this.props.instrument.config.entity;
        this.props.actionSetMode(this.props.instrument.id, "load");
        this.props.actionSetEntities(this.props.instrument.id, [entity]);
        this.props.actionSetTitle(this.props.instrument.id, entity);

        let query = _.toPairs(this.props.instrument.config.assignment)
            .map(([axis, dim]) => {
                if (!dim.agg) return `a=${axis},${dim.name},true`;
                let path = dim.agg.path.join("+");
                return `agg=${axis},${dim.agg.f},${path},${dim.agg.entity},${dim.agg.attribute}`;
            })
            .join("&")
        ;

        let url = `http://localhost:3000/entity-points/${entity}?${query}`;
        fetch(url)
            .then(response => response.json())
            .then(json => {
                //TODO: add progress to the loader, perhaps using oboe.js to stream the load.

                let points = json.points;
                let tagsToConvert = [];
                const NEED_CONVERSION = ["datetime"];
                for (let tag in json.attributes) {
                    let a = json.attributes[tag];
                    let type = this.props.metadata.attributes[a].type;
                    if (_.includes(NEED_CONVERSION, type)) tagsToConvert.push({
                        tag,
                        type
                    });
                }
                for (let tag in json.aggregates) {
                    let a = json.aggregates[tag];
                    let type = this.props.metadata.attributes[a.attribute].type;
                    if (_.includes(NEED_CONVERSION, type)) tagsToConvert.push({
                        tag,
                        type
                    });
                }
                for (let d of tagsToConvert) {
                    switch (d.type) {
                        case "datetime":
                            // Stored as epoch seconds, need epoch milliseconds
                            for (let p of points) {
                                let value = p[d.tag];
                                if (!value) {
                                    p[d.tag] = null;
                                }
                                else {
                                    p[d.tag] = new Date(value * 1000);
                                }
                            }
                            break;
                        default:
                            // No change
                    }
                }

                this.setState({ points });
                this.props.actionSetMode(this.props.instrument.id, "grid");
            })
        ;
    };
}


class Icicle extends Component {
    //TODO: allow for cases where an entity has multiple roots, distinguished by their attributes

    constructor(props) {
        super(props);

        let root = {
            id: null,
            name: "Not Found",
            children: []
        };
        let validEntities = _.keys(this.props.metadata.hierarchyRoots);

        try {
            // Entity may be provided in config prop, or get it from metadata
            if (props.instrument.config && props.instrument.config.entity) {
                this.state = {
                    validEntities,
                    root
                };

                this.getHierarchy();
            }
            else {
                let entity = validEntities[0];

                this.state = {
                    validEntities,
                    root
                };

                this.props.actionSetConfig(this.props.instrument.id, {
                    entity
                });
            }
        }
        catch(e) {
            console.log(e);
            this.props.actionSetMode(this.props.instrument.id, "error");
            //TODO: error action
        }
    }

    componentDidUpdate() {
        let chart = ReactDOM.findDOMNode(this.refs.chart);
        if (!chart) return;

        const GAP = 4,
            FONT_SIZE = 14,
            COLOUR = this.props.metadata.entities[this.props.instrument.config.entity].colour,
            W = this.props.width,
            H = this.props.height
        ;

        // Update hierarchy
        let partition = d3.layout.partition()
            .size([W, H])
            .value(d => 1)      //TODO: Add a configurable weighting attribute
            .nodes(this.state.root)
        ;

        let context = chart.getContext("2d");

        context.font = FONT_SIZE + "px Arial";

        // Clear draw area
        context.fillStyle = "white";
        context.fillRect(0, 0, W, H);

        // Draw partitions with text labels
        context.strokeStyle = "white";
        context.lineWidth = GAP * 0.33;
        context.lineJoin = "miter";
        for (let p of partition) {
            let width = p.dx - GAP;
            let height = p.dy - GAP;
            if ((width < GAP) || height < GAP) continue;

            context.beginPath();
            context.fillStyle = COLOUR;
            context.rect(
                p.x + GAP / 2,
                p.y + GAP / 2,
                width,
                height
            );
            context.fill();

            context.fillStyle = "white";
            context.fillText(p.name, p.x + GAP * 2, p.y + GAP * 2 + FONT_SIZE);
        }

        // Draw over with outline for related partitions
        context.lineWidth = 0;
        for (let p of partition) {
            // Highlight partitions at the top of a tree of selected nodes.
            if (!_.includes(this.props.related, p.id)) continue;
            if (!!p.parent && _.includes(this.props.related, p.parent.id)) continue;

            let width = p.dx - GAP;
            let height = p.dy - GAP;
            if ((width < GAP) || height < GAP) continue;

            context.strokeStyle = "gray";
            context.beginPath();
            context.rect(
                p.x + GAP / 2,
                p.y + GAP / 2,
                width,
                height
            );
            context.stroke();
        }

        // Draw over with outline for selected partitions
        context.lineWidth = 0;
        for (let p of partition) {
            // Highlight partitions at the top of a tree of selected nodes.
            if (!_.includes(this.props.selected, p.id)) continue;
            if (!!p.parent && _.includes(this.props.selected, p.parent.id)) continue;

            let width = p.dx - GAP;
            let height = p.dy - GAP;
            if ((width < GAP) || height < GAP) continue;

            context.strokeStyle = "black";
            context.beginPath();
            context.rect(
                p.x + GAP / 2,
                p.y + GAP / 2,
                width,
                height
            );
            context.stroke();

            context.strokeStyle = "white";
            context.lineWidth = 3;
            context.lineJoin = "round";
            context.strokeText(p.name, p.x + GAP * 2, p.y + GAP * 2 + FONT_SIZE);
            context.fillStyle = "black";
            context.fillText(p.name, p.x + GAP * 2, p.y + GAP * 2 + FONT_SIZE);
        }

        chart.onclick = e => {
            function getDescendantIds(node) {
                if (!node.children) return [node.id];
                let childIds = node.children.map(child => getDescendantIds(child));
                return [node.id].concat(...childIds);
            }

            let clicked = _.find(partition, d => (
                (e.offsetX > d.x) &&
                (e.offsetX < (d.x + d.dx)) &&
                (e.offsetY > d.y) &&
                (e.offsetY < (d.y + d.dy))
            ));
            if (!clicked) return;
            let ids = getDescendantIds(clicked);

            this.props.actionFetchSelection(ids);
        };
    }

    render() {
        let style = {
            chart: {
                width: this.props.width,
                height: this.props.height
            }
        };

        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            case "load":
                // Show loading progress component.
                return <ProgressBar active now={100} label={"%(percent)s%"}>
                </ProgressBar>;
                break;
            case "config":
                // Show a config form.
                return <form>
                    <Input
                        ref="selectEntity"
                        type="select"
                        label="Entity type:"
                        defaultValue={this.props.instrument.config.entity}
                        onChange={() => {
                            let entity = this.refs.selectEntity.getValue();
                            this.props.actionSetConfig(this.props.instrument.id, {
                                entity
                            });
                        }}
                    >
                        {this.state.validEntities.map((d, i) =>
                            <option key={i} value={d}>
                                {d}
                            </option>
                        )}
                    </Input>
                    <ButtonInput
                        value="Create Icicle Plot"
                        onClick={this.getHierarchy}
                        disabled={!this.props.instrument.config.entity}
                    ></ButtonInput>
                </form>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                // Normal mode, showing the plot with what data we have.
                return <canvas
                    ref="chart"
                    width={this.props.width}
                    height={this.props.height}
                    style={style.chart}
                />;
        }
    }

    getHierarchy = () => {
        let entity = this.props.instrument.config.entity;
        this.props.actionSetMode(this.props.instrument.id, "load");
        this.props.actionSetEntities(this.props.instrument.id, [entity]);
        this.props.actionSetTitle(this.props.instrument.id, entity);

        let url = `http://localhost:3000/hierarchy/${entity}`;
        fetch(url)
            .then(response => response.json())
            .then(json => {
                //TODO: add progress to the loader, perhaps using oboe.js to stream the load.

                function buildNested(id, hierarchy) {
                    let node = _.find(hierarchy, {id});
                    if (!node) return {};
                    node.children = node.children
                        .map(id => buildNested(id, hierarchy))
                        .filter(d => !!d.id)
                    ;
                    return node;
                }

                // Build d3-compatible hierarchy object
                let idRoot = this.props.metadata.hierarchyRoots[entity][0].id;
                let root = buildNested(idRoot, json);

                this.setState({
                    root
                });
                this.props.actionSetMode(this.props.instrument.id, "grid");
            })
        ;
    };
}


class Chart extends Component {
    constructor(props) {
        super(props);

        let type;
        try {
            // Entity may be provided in config prop, or get it from metadata
            if (props.instrument.config && props.instrument.config.type) {
                type = props.instrument.config.type;
            }
            else {
                type = "line";
            }

            this.state = {
                data: {}
            };
        }
        catch(e) {
            console.log(e);
            this.props.actionSetMode(this.props.instrument.id, "error");
            //TODO: error action
        }
    }

    componentDidUpdate() {
        let chart = ReactDOM.findDOMNode(this.refs.chart);
        if (!chart) return;

        // Resize the canvas if it changed
    }

    render() {
        let style = {
            chart: {
                width: this.props.width,
                height: this.props.height
            }
        };

        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            case "load":
                // Show loading progress component.
                return <ProgressBar active now={100} label={"%(percent)s%"}>
                </ProgressBar>;
                break;
            case "config":
                // Show a config form.
                let types = ["line", "bar", "radar", "polar", "pie", "doughnut"];
                return <form>
                    <Input
                        ref="selectType"
                        type="select"
                        label="Chart type:"
                        defaultValue={this.state.type}
                        onChange={() => {
                            let type = this.refs.selectType.getValue();
                            this.setState({
                                type
                            })
                        }}
                    >
                        {types.map((d, i) =>
                            <option key={i} value={d}>
                                {d}
                            </option>
                        )}
                    </Input>
                    <ButtonInput
                        value="Create Chart"
                        onClick={this.getData}
                        disabled={!this.state.type}
                    ></ButtonInput>
                </form>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                return null;

        }
    }

    getData = () => {
        this.props.actionSetMode(this.props.instrument.id, "load");

        switch (this.state.type) {
            case "line":
                break;
            case "bar":
                break;
            case "radar":
                break;
            case "polar":
                break;
            case "pie":
                break;
            case "doughnut":
                break;
        }

        let url = ``;
        fetch(url)
            .then(response => response.json())
            .then(json => {
                //TODO: add progress to the loader, perhaps using oboe.js to stream the load.

                // Get whatever data is needed for the chart, and put it in the form specified
                // for chartjs at: http://www.chartjs.org/docs/

                this.setState({
                    //
                });
                this.props.actionSetMode(this.props.instrument.id, "grid");
            })
        ;
    };
}


class GraphER extends Component {
    // Graph of the data structure captured in the metadata. i.e. the E-R diagram of the data.
    // Takes a lot from this example: http://bl.ocks.org/d3noob/5141278

    constructor(props) {
        super(props);

        let nodes = _.toPairs(this.props.metadata.entities).map(d => ({
            name: d[0],
            isHierarchy: !!this.props.metadata.hierarchyRoots[d[0]],
            count: d[1].count,
            colour: d[1].colour
        }));
        let links = [];
        for (let name of _.keys(this.props.metadata.relationships)) {
            let r = this.props.metadata.relationships[name];
            for (let shape of r.shapes) {
                links.push({
                    name,
                    source: _.find(nodes, { name: shape.from }),
                    target: _.find(nodes, { name: shape.to }),
                    value: shape.count
                });
            }
        }
        // Find any doubled up links
        for (let link of links) {
            link.doubled = false;
            if (link.source === link.target) continue;
            for (let otherLink of links) {
                if ((link.source === otherLink.target) && (link.target === otherLink.source)) {
                    link.doubled = true;
                }
            }
        }

        let layout = cola.d3adaptor()
            .links(links)
        ;

        let realGraphNodes = nodes.slice(0);

        this.state = {
            showDetail: false,
            detail: {
                subject: null,
                x: null,
                y: null,
                z: null
            }
        };
        this.unrenderedState = {
            layout,
            realGraphNodes
        };
    }

    shouldComponentUpdate(nextProps, nextState) {
        return (nextProps.instrument.mode !== this.props.instrument.mode)
            || (nextProps.queryPath !== this.props.queryPath)
            || (nextProps.queryTree !== this.props.queryTree)
            || (nextProps.metadata !== this.props.metadata)
            || (nextProps.height !== this.props.height)
            || (nextProps.width !== this.props.width)
            || (nextState !== this.state)
        ;
    }

    componentDidMount() {
        this.props.actionSetMode(this.props.instrument.id, "grid");
    }

    componentDidUpdate() {
        let chart = ReactDOM.findDOMNode(this.refs.chart);
        if (!chart) return;

        const
            W = this.props.width,
            H = this.props.height,
            N = this.unrenderedState.realGraphNodes.length,
            L = Math.min(W, H) / Math.sqrt(N)
        ;

        let style = {
            pathLink: {
                fill: "none",
                "stroke-width": 2
            },
            circle: {
                "stroke-width": 2,
                cursor: "pointer"
            },
            textOver: {
                fill: "black",
                stroke: "none",
                cursor: "pointer"
            },
            textUnder: {
                fill: "white",
                stroke: "white",
                "stroke-width": 4,
                "stroke-linejoin": "round",
                cursor: "pointer"
            },
            markerNormal: {
                stroke: "none",
                fill: "lightgray"
            },
            markerSelected: {
                stroke: "none",
                fill: "black"
            }
        };

        let isLinkSelected = link => {
            let name = link.name;
            let source = link.source.name;
            let target = link.target.name;
            let queryPath = this.props.queryPath;
            let i = queryPath.length - 2;
            while (i > 0) {
                if (queryPath[i] === name) {
                    if ((queryPath[i - 1] === source) && (queryPath[i + 1] === target)) return true;
                    if ((queryPath[i + 1] === source) && (queryPath[i - 1] === target)) return true;
                }
                i--;
            }
            return false;
        };

        let nodes = this.unrenderedState.realGraphNodes.slice(),
            nodeRadius = L * 0.2,
            pageBounds = { x: nodeRadius, y: nodeRadius, width: W - nodeRadius * 2, height: H - nodeRadius * 2 },
            topLeft = { x: pageBounds.x, y: pageBounds.y, fixed: true },
            tlIndex = nodes.push(topLeft) - 1,
            bottomRight = { x: pageBounds.x + pageBounds.width, y: pageBounds.y + pageBounds.height, fixed: true },
            brIndex = nodes.push(bottomRight) - 1,
            constraints = [];
        for (var i = 0; i < this.unrenderedState.realGraphNodes.length; i++) {
            constraints.push({ axis: 'x', type: 'separation', left: tlIndex, right: i, gap: nodeRadius });
            constraints.push({ axis: 'y', type: 'separation', left: tlIndex, right: i, gap: nodeRadius });
            constraints.push({ axis: 'x', type: 'separation', left: i, right: brIndex, gap: nodeRadius });
            constraints.push({ axis: 'y', type: 'separation', left: i, right: brIndex, gap: nodeRadius });
        }

        this.unrenderedState.layout
            .nodes(nodes)
            .size([W, H])
            .constraints(constraints)
            .linkDistance(L)
            .on("tick", tick)
            .start(10)
        ;

        let d3graph = d3.select(ReactDOM.findDOMNode(this.refs.graph));
        let d3markerNormal = d3.select(ReactDOM.findDOMNode(this.refs.markerNormal));
        let d3markerPathNormal = d3.select(ReactDOM.findDOMNode(this.refs.markerPathNormal));
        let d3markerSelected = d3.select(ReactDOM.findDOMNode(this.refs.markerSelected));
        let d3markerPathSelected = d3.select(ReactDOM.findDOMNode(this.refs.markerPathSelected));

        // Set up markers.
        d3markerNormal
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", nodeRadius + 6)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .style(style.markerNormal)
        ;
        d3markerPathNormal.attr("d", "M0,-5L10,0L0,5");
        d3markerSelected
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", nodeRadius + 6)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .style(style.markerSelected)
        ;
        d3markerPathSelected.attr("d", "M0,-5L10,0L0,5");

        // D3 refresh.
        let link = d3graph.selectAll("g.link")
            .data(this.unrenderedState.layout.links())
        ;
        let linkEnter = link
            .enter()
            .append("g")
            .attr("class", "link")
            .on("click", d => {
                this.selectLink(d);
            })
        ;
        linkEnter.append("path");
        linkEnter.append("text")
            .style(style.textUnder)
            .attr("text-anchor", "middle")
            .attr("dy", "0.5ex")
            .text(d => d.name)
        ;
        linkEnter.append("text")
            .style(style.textOver)
            .attr("text-anchor", "middle")
            .attr("dy", "0.5ex")
            .text(d => d.name)
        ;
        link.select("path")
            .style(_.defaults(style.pathLink, {
                stroke: d => isLinkSelected(d) ? "black" : "lightgray"
            }))
            .filter(d => d.source !== d.target)
            .attr("marker-end", d => isLinkSelected(d) ? "url(#markerSelected)" : "url(#markerNormal)" )
        ;
        let node = d3graph.selectAll("g.node")
            .data(this.unrenderedState.realGraphNodes)
        ;
        let nodeEnter = node.enter()
            .append("g")
            .attr("class", "node")
            .on("click", d => {
                if (d3.event.defaultPrevented) return;
                this.selectNode(d);
            })
        ;
        nodeEnter.append("circle");
        nodeEnter.append("text")
            .style(style.textUnder)
            .attr("text-anchor", "middle")
            .attr("dy", "0.5ex")
            .text(d => d.name)
        ;
        nodeEnter.append("text")
            .style(style.textOver)
            .attr("text-anchor", "middle")
            .attr("dy", "0.5ex")
            .text(d => d.name)
        ;
        node.select("circle")
            .attr("r", nodeRadius)
            .style(_.defaults(style.circle, {
                fill: d => d.colour,
                stroke: d => (_.includes(this.props.queryPath, d.name)) ? "black" : "white"
            }))
        ;
        node.call(this.unrenderedState.layout.drag);

        // Handle line curves and constrain nodes
        function tick() {
            //TODO: Properly draw edges to self, multiple edges between two nodes, or both.
            node.attr("transform", d => {
                return "translate(" + d.x + "," + d.y + ")";
            });
            link.each(d => {
                if (d.doubled) {
                    // Offset middle to avoid overlaps
                    const k = 0.4;
                    const deltaX = d.target.x - d.source.x;
                    const deltaY = d.target.y - d.source.y;
                    const h = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
                    const theta = Math.atan2(deltaY, deltaX);
                    d.midX = h * Math.cos(theta) * k + d.source.x;
                    d.midY = h * Math.sin(theta) * k + d.source.y;
                }
                else {
                    d.midX = (d.source.x + d.target.x) * 0.5;
                    d.midY = (d.source.y + d.target.y) * 0.5;
                }
            });
            link.each(dLink => {
                // For edges to self, move mid point out where there is space for it, i.e. opposite to average of all edges
                if (dLink.source.name === dLink.target.name) {
                    let thetas = [];
                    link.each(d => {
                        if (
                            (d !== dLink)
                            && (
                                (d.source.name === dLink.source.name)
                                || (d.target.name === dLink.source.name)
                                || (d.source.name === dLink.target.name)
                                || (d.target.name === dLink.target.name)
                            )
                        ) {
                            thetas.push(Math.atan2(d.midY - dLink.midY, d.midX - dLink.midX));
                        }
                    });
                    thetas.sort((a, b) => a - b);
                    thetas.push(2 * Math.PI + thetas[0]);
                    let maxGap = 0;
                    let theta = 0;
                    let i = thetas.length;
                    while (i > 0) {
                        i--;
                        let gap = thetas[i] - thetas[i - 1];
                        if (gap > maxGap) {
                            maxGap = gap;
                            theta = thetas[i] - gap / 2;
                        }
                    }
                    //console.log(thetas.map(d => d / Math.PI), theta / Math.PI);///
                    let h = nodeRadius * 2;
                    dLink.midX = dLink.midX + Math.cos(theta) * h;
                    dLink.midY = dLink.midY + Math.sin(theta) * h;
                }
            });
            link.select("path")
                .attr("d", d => {
                    // Using three segments for all types, in case we want to transition them in the future.
                    if (d.source === d.target) {
                        // Edge going back to self
                        return `
                            M${d.source.x},${d.source.y}
                            A${nodeRadius} ${nodeRadius}, 0, 0, 0, ${d.midX} ${d.midY}
                            A${nodeRadius} ${nodeRadius}, 0, 0, 0, ${d.target.x} ${d.target.y}
                        `;
                    }
                    else {
                        // Regular straight edge
                        return `
                            M${d.source.x},${d.source.y}
                            L${d.midX},${d.midY}
                            L${d.target.x},${d.target.y}
                        `;
                    }
                })
            ;
            link.selectAll("text").attr("transform", d => {
                return "translate(" + d.midX + "," + d.midY + ")";
            });
        }
    }

    render() {
        let style = {
            container: {
            },
            chart: {
                width: this.props.width,
                height: this.props.height
            },
            info: {
                position: "absolute",
                left: 0,
                bottom: 0
            }
        };

        //switch (this.props.layout.mode) {
        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                // Normal mode, showing the plot with what data we have.
                return <div style={style.container}>
                    <svg
                        ref="chart"
                        style={style.chart}
                    >
                        <defs>
                            <marker ref="markerNormal" id="markerNormal">
                                <path ref="markerPathNormal" ></path>
                            </marker>
                            <marker ref="markerSelected" id="markerSelected">
                                <path ref="markerPathSelected" ></path>
                            </marker>
                        </defs>
                        <g ref="graph" ></g>
                    </svg>
                    <div style={style.info}>
                        <Button
                            bsSize="xsmall"
                            onClick={event => this.toggleDetails()}
                        ><Glyphicon glyph="eye-open" /></Button>
                        <Modal show={this.state.showDetail} onHide={this.toggleDetails}>
                            <Modal.Header closeButton>
                                <Modal.Title>Path Details</Modal.Title>
                            </Modal.Header>
                            <Modal.Body>
                                <Table>
                                    <thead><tr>
                                        <th/><th>Name</th><th>Count</th><th>Subject</th><th>x</th><th>y</th><th>z</th>
                                    </tr></thead>
                                    <tbody>{
                                        this.props.queryPath.map((name, i) => (i % 2)
                                            ? this.getRelationshipDetail(
                                                this.props.queryPath[i - 1],
                                                name,
                                                this.props.queryPath[i + 1]
                                            )
                                            : this.getEntityDetail(name, i))
                                    }</tbody>
                                </Table>
                                <Button
                                    onClick={event => this.makeNewScatterPlot()}
                                    disabled={!this.state.detail.subject
                                        || !this.state.detail.x
                                        || !this.state.detail.y
                                        || !this.state.detail.z
                                    }
                                >Show scatter plot</Button>
                            </Modal.Body>
                        </Modal>
                    </div>
                </div>;
        }
    }

    getEntityDetail = (entityName, i) => {
        let entity = this.props.metadata.entities[entityName];

        let style = {
            dot: {
                color: entity.colour
            },
            attributeName: {
                textIndent: "2em"
            }
        };

        let entityRow = <tr key={`entity_${entityName}_${i}`} style={style.entity}>
            <td style={style.dot}>⬤</td>
            <td>{entityName}</td>
            <td>{entity.count}</td>
            <td><Input
                type="radio"
                name="subject"
                wrapperClassName="col-xs-offset-2 col-xs-10"
                checked={entityName === this.state.detail.subject && i === this.state.detail.i}
                onChange={event => this.setSubject(entityName, i)}
            /></td>
            <td/>
            <td/>
            <td/>
        </tr>;
        if (!this.state.detail.subject) return entityRow;

        let rows = [];
        if (entityName === this.state.detail.subject && i === this.state.detail.i) {
            // Prepare an attribute config to pass to the plot.
            rows = entity.attributes.map(attributeName => <tr key={`attribute_${attributeName}`} >
                <td/>
                <td style={style.attributeName} >{attributeName}</td>
                <td/>
                <td/>
                <td><Input
                    type="radio"
                    name="x"
                    wrapperClassName="col-xs-offset-2 col-xs-10"
                    onChange={event => this.setAttribute("x", attributeName)}
                /></td>
                <td><Input
                    type="radio"
                    name="y"
                    wrapperClassName="col-xs-offset-2 col-xs-10"
                    onChange={event => this.setAttribute("y", attributeName)}
                /></td>
                <td><Input
                    type="radio"
                    name="z"
                    wrapperClassName="col-xs-offset-2 col-xs-10"
                    onChange={event => this.setAttribute("z", attributeName)}
                /></td>
            </tr>);
        }
        else {
            // Prepare an aggregate config to pass to the plot.
            let attributeNames = this.props.metadata.entities[entityName].attributes;
            let canSum = ["currency", "float", "integer"];
            let rowsSum = attributeNames
                .filter(attributeName => _.includes(canSum, this.props.metadata.attributes[attributeName].type))
                .map(attributeName => <tr key={`aggregate_sum_${entityName}_${attributeName}`} >
                    <td/>
                    <td style={style.attributeName} >{"sum of " + attributeName}</td>
                    <td/>
                    <td/>
                    <td><Input
                        type="radio"
                        name="x"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("x", attributeName, entityName, "sum")}
                    /></td>
                    <td><Input
                        type="radio"
                        name="y"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("y", attributeName, entityName, "sum")}
                    /></td>
                    <td><Input
                        type="radio"
                        name="z"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("z", attributeName, entityName, "sum")}
                    /></td>
                </tr>)
            ;
            let rowsAvg = attributeNames
                .filter(attributeName => _.includes(canSum, this.props.metadata.attributes[attributeName].type))
                .map(attributeName => <tr key={`aggregate_avg_${entityName}_${attributeName}`} >
                    <td/>
                    <td style={style.attributeName} >{"average " + attributeName}</td>
                    <td/>
                    <td/>
                    <td><Input
                        type="radio"
                        name="x"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("x", attributeName, entityName, "avg")}
                    /></td>
                    <td><Input
                        type="radio"
                        name="y"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("y", attributeName, entityName, "avg")}
                    /></td>
                    <td><Input
                        type="radio"
                        name="z"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("z", attributeName, entityName, "avg")}
                    /></td>
                </tr>)
            ;
            //TODO: could do min currency and float as well
            let rowsMin = attributeNames
                .filter(attributeName => this.props.metadata.attributes[attributeName].type === "datetime")
                .map(attributeName => <tr key={`aggregate_min_${entityName}_${attributeName}`} >
                    <td/>
                    <td style={style.attributeName} >{"earliest " + attributeName}</td>
                    <td/>
                    <td/>
                    <td><Input
                        type="radio"
                        name="x"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("x", attributeName, entityName, "min")}
                    /></td>
                    <td><Input
                        type="radio"
                        name="y"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("y", attributeName, entityName, "min")}
                    /></td>
                    <td><Input
                        type="radio"
                        name="z"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("z", attributeName, entityName, "min")}
                    /></td>
                </tr>)
            ;
            let rowsMax = attributeNames
                .filter(attributeName => this.props.metadata.attributes[attributeName].type === "datetime")
                .map(attributeName => <tr key={`aggregate_max_${entityName}_${attributeName}`} >
                    <td/>
                    <td style={style.attributeName} >{"latest " + attributeName}</td>
                    <td/>
                    <td/>
                    <td><Input
                        type="radio"
                        name="x"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("x", attributeName, entityName, "max")}
                    /></td>
                    <td><Input
                        type="radio"
                        name="y"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("y", attributeName, entityName, "max")}
                    /></td>
                    <td><Input
                        type="radio"
                        name="z"
                        wrapperClassName="col-xs-offset-2 col-xs-10"
                        onChange={event => this.setAggregate("z", attributeName, entityName, "max")}
                    /></td>
                </tr>)
            ;
            rows = rows
                .concat(rowsSum)
                .concat(rowsAvg)
                .concat(rowsMin)
                .concat(rowsMax)
            ;
        }

        rows.unshift(entityRow);
        return rows;
    };

    getRelationshipDetail = (precursor, name, successor) => {
        let up = true;
        let count = 0;
        let relationship = this.props.metadata.relationships[name];
        for (let shape of relationship.shapes) {
            if ((shape.from === precursor) && (shape.to === successor)) {
                up = false;
                count = shape.count;
                break;
            }
            if ((shape.from === successor) && (shape.to === precursor)) {
                up = true;
                count = shape.count;
                break;
            }
        }

        let style = {
            backgroundColor: "whitesmoke"
        };

        return <tr key={`relationship_${precursor}_${name}_${successor}`} style={style} >
            <td><Glyphicon glyph={up ? "arrow-up" : "arrow-down"} bsSize="xsmall" /></td>
            <td>{name}</td>
            <td>{count}</td>
            <td/>
            <td/>
            <td/>
            <td/>
        </tr>;
    };

    setSubject = (subject, i) => {
        let detail = {
            subject,
            i,
            x: null,
            y: null,
            z: null
        };
        this.setState({ detail });
    };

    setAttribute = (dimension, name) => {
        let detail = this.state.detail;
        detail[dimension] = {
            name,
            agg: null
        };
        this.setState({ detail });
    };

    setAggregate = (dimension, attribute, entity, f="sum") => {
        let detail = this.state.detail;

        // Get path as the section of queryPath between the subject and destination, exclusively.
        let queryPath = this.props.queryPath;
        let iStart = queryPath.findIndex(d => d === this.state.detail.subject);
        let iEnd = queryPath.findIndex(d => d === entity);
        if ((iStart < 0) || (iEnd < 0) || (iStart === iEnd)) return;
        let path = [];
        if (iStart < iEnd) {
            path = queryPath.slice(iStart + 1, iEnd);
        }
        else {
            let reverse = queryPath.slice().reverse();
            path = reverse.slice( -iStart, -iEnd - 1);
        }

        detail[dimension] = {
            name: `${f} of ${attribute} for ${entity} (${path.join(", ")})`,
            agg: {
                attribute,
                entity,
                f,
                path
            }
        };
        this.setState({ detail });
    };

    toggleDetails = () => {
        this.setState({ showDetail: !this.state.showDetail });
    };

    selectNode = node => {
        let links = this.unrenderedState.layout.links();
        let selectedPath = this.props.queryPath;

        // If there is no selection already, just create with this node.
        if (selectedPath.length < 1) {
            selectedPath = [node.name];
        }
        // If already selected and an end point, remove from selection.
        else if (node.name === selectedPath[0]) {
            selectedPath.shift();
            selectedPath.shift();
        }
        else if (node.name === selectedPath[selectedPath.length - 1]) {
            selectedPath.pop();
            selectedPath.pop();
        }
        // If not already selected, check if connected to existing endpoint. If so, add it.
        else if (!_.includes(selectedPath, node.name)) {
            let startName = selectedPath[0];
            let endName = selectedPath[selectedPath.length - 1];

            for (let link of links) {
                let sourceName = link.source.name;
                let targetName = link.target.name;

                if (node.name === sourceName) {
                    if (targetName === startName) {
                        selectedPath.unshift(link.name);
                        selectedPath.unshift(node.name);
                        break;
                    }
                    else if (targetName === endName) {
                        selectedPath.push(link.name);
                        selectedPath.push(node.name);
                        break;
                    }
                }
                else if (node.name === targetName) {
                    if (sourceName === startName) {
                        selectedPath.unshift(link.name);
                        selectedPath.unshift(node.name);
                        break;
                    }
                    else if (sourceName === endName) {
                        selectedPath.push(link.name);
                        selectedPath.push(node.name);
                        break;
                    }
                }
            }
        }
        // If already selected and not an end point, ignore it.

        this.props.actionSetQueryPath(selectedPath);
    };

    selectLink = link => {
        let selectedPath = this.props.queryPath;
        let selectedPathStartSegment = selectedPath.slice(0, 3);
        let selectedPathEndSegment = selectedPath.slice(-3, selectedPath.length).reverse();
        let linkPath = [link.source.name, link.name, link.target.name];
        let linkPathReverse = linkPath.slice().reverse();

        function isSection(inner, outer) {
            let i = outer.slice(0, -2).findIndex(d => d === inner[0]);
            if (i < 0) return false;
            return (_.isEqual(outer.slice(i, i + inner.length), inner));
        }

        //TODO: These conditions ignore where links of same name exist between different nodes. Fix this.
        // If there is no selection already, just create with this link.
        if (selectedPath.length < 1) {
            selectedPath = [link.source.name, link.name, link.target.name];
        }
        // If this is the only link in the path, remove all.
        else if (_.isEqual(linkPath, selectedPath) || _.isEqual(linkPath, selectedPath.slice().reverse())) {
            selectedPath = [];
        }
        // If already selected and an end segment, remove from selection.
        else if (_.isEqual(linkPath, selectedPathStartSegment)
            || _.isEqual(linkPathReverse, selectedPathStartSegment)
        ) {
            selectedPath.shift();
            selectedPath.shift();
        }
        else if (_.isEqual(linkPath, selectedPathEndSegment)
            || _.isEqual(linkPathReverse, selectedPathEndSegment)
        ) {
            selectedPath.pop();
            selectedPath.pop();
        }
        // If already selected but not an end point, ignore it.
        else if (isSection(linkPath, selectedPath) || isSection(linkPathReverse, selectedPath)) {
            return;
        }
        // If not already selected, check if connected to existing endpoint. If so, add it.
        else if (selectedPathStartSegment[0] === linkPath[0]) {
            selectedPath.unshift(linkPath[1]);
            selectedPath.unshift(linkPath[2]);
        }
        else if (selectedPathStartSegment[0] === linkPathReverse[0]) {
            selectedPath.unshift(linkPathReverse[1]);
            selectedPath.unshift(linkPathReverse[2]);
        }
        else if (selectedPathEndSegment[0] === linkPath[0]) {
            selectedPath.push(linkPath[1]);
            selectedPath.push(linkPath[2]);
        }
        else if (selectedPathEndSegment[0] === linkPathReverse[0]) {
            selectedPath.push(linkPathReverse[1]);
            selectedPath.push(linkPathReverse[2]);
        }
        // Ignore everything else.

        this.props.actionSetQueryPath(selectedPath);
    };

    makeNewScatterPlot = () => {
        let config = {
            entity: this.state.detail.subject,
            assignment: {
                x: this.state.detail.x,
                y: this.state.detail.y,
                z: this.state.detail.z
            }
        };
        this.props.actionCreateInstrument("scatter", config)
    };
}


class GraphSelected extends Component {
    // Graph of the data structure captured in the metadata. i.e. the E-R diagram of the data.
    // Takes a lot from this example: http://bl.ocks.org/d3noob/5141278

    constructor(props) {
        super(props);

        this.state = {
            graph: []
        };

        this.unrenderedState = {
            zoom: d3.behavior.zoom()
        };

        this.fetchDetails(props.selected, props.related);
    }

    componentDidMount() {
        let d3chart = d3.select(ReactDOM.findDOMNode(this.refs.chart));
        let d3graphContainer = d3.select(ReactDOM.findDOMNode(this.refs.graphContainer));
        // Handle pan and zoom
        this.unrenderedState.zoom
            .on("zoom", () => {
                d3graphContainer.attr("transform", `translate(${d3.event.translate})scale(${d3.event.scale})`);
            })
        ;
        d3chart.call(this.unrenderedState.zoom);
    }

    componentWillReceiveProps(nextProps) {
        if ((nextProps.selected !== this.props.selected)
            || (nextProps.related !== this.props.related)
            || (nextProps.queryPath !== this.props.queryPath)
            || (nextProps.queryTree !== this.props.queryTree)
        ) {
            this.fetchDetails(nextProps.selected, nextProps.related);
        }
    }

    componentDidUpdate() {
        let chart = ReactDOM.findDOMNode(this.refs.chart);
        if (!chart) return;

        const
            W = this.props.width,
            H = this.props.height,
            N = this.state.graph.length,
            L = Math.min(W, H) / Math.sqrt(N),
            R_MAX =  L * 0.4,
            R_MIN =  L * 0.1,
            R_DEFAULT = L * 0.25,
            //K = Math.sqrt(N / (W * H))
            FORMAT_CURRENCY = d3.format("$,.2s")
        ;

        let amounts = this.state.graph
            .filter(d => d.node.hasOwnProperty("amount"))
            .map(d => d.node.amount)
        ;
        let scaleR = d3.scale.linear()      //TODO: Log scale would be nice, but can't handle 0 in domain boundaries
            .domain(d3.extent(amounts))
            .range([R_MIN, R_MAX])
        ;

        //TODO: r and label attributes should be configurable somewhere, and format string will eventually be from metadata
        let nodes = this.state.graph.map(d => _.defaults(d, {
            colour: this.props.metadata.entities[d.entity].colour,
            name: d.node.pretty
                || d.node.name
                || d.node.code
                || (d.node.hasOwnProperty("amount") && FORMAT_CURRENCY(+d.node.amount))
                || d.node.status
                || d.node.description
                || d.node.address
                || d.node.number
                || d.node.source_id
                || "",
            r: d.node.hasOwnProperty("amount") ? scaleR(+d.node.amount) : R_DEFAULT
        }));
        let links = [];
        for (let source of nodes) {
            for (let id of source.related) {
                let target = _.find(nodes, { id });
                if (!target) continue;
                links.push({
                    source,
                    target,
                    value: 1
                });
            }
        }

        if (this.force) this.force.stop();
        this.force = d3.layout.force()
            .size([W, H])
            .nodes(nodes)
            .links(links)
            .linkDistance(L)
            .charge(-(W + H) / 2)
            //.charge(-50 / K)
            //.gravity(50 * K)
            .on("tick", tick)
            .start()
        ;
        // Suppress panning on whole graph group.
        this.force.drag().on("dragstart", () => d3.event.sourceEvent.stopPropagation());

        let style = {
            pathLink: {
                fill: "none",
                stroke: "gray",
                "stroke-width": "1.5px"
            },
            circle: {
                "stroke-width": 2
            },
            textOver: {
                fill: "black",
                //font: "10px sans-serif",
                stroke: "none",
                "pointer-events": "none"
            },
            textUnder: {
                fill: "white",
                //font: "10px sans-serif",
                stroke: "white",
                "stroke-width": 4,
                "stroke-linejoin": "round",
                "pointer-events": "none"
            },
            background: {
                fill: "white",
                stroke: "lightgray",
                "stroke-width": 2
            }
        };

        //let d3graphContainer = d3.select(ReactDOM.findDOMNode(this.refs.graphContainer));
        let d3graphEdges = d3.select(ReactDOM.findDOMNode(this.refs.graphEdges));
        let d3graphNodes = d3.select(ReactDOM.findDOMNode(this.refs.graphNodes));
        let d3graphBackground = d3.select(ReactDOM.findDOMNode(this.refs.graphBackground));
        let d3marker = d3.select(ReactDOM.findDOMNode(this.refs.marker));
        let d3markerPath = d3.select(ReactDOM.findDOMNode(this.refs.markerPath));
        //
        //// Handle pan and zoom
        //this.unrenderedState.zoom
        //    .on("zoom", () => {
        //        d3graphContainer.attr("transform", `translate(${d3.event.translate})scale(${d3.event.scale})`);
        //    })
        //;
        //d3graphContainer.call(this.unrenderedState.zoom);
        d3graphBackground
            .attr("width", W)
            .attr("height", H)
            .style(style.background)
        ;

        // Set up markers.
        d3marker
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 15)
            //.attr("refY", -1.5)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
        ;
        d3markerPath.attr("d", "M0,-5L10,0L0,5");

        // D3 refresh.
        let path = d3graphEdges.selectAll("path.link")
            .data(this.force.links(), d => [d.source.id, d.target.id].join(","))
        ;
        let pathEnter = path
            .enter().append("path")
            .attr("class", "link")
            //.attr("marker-mid", "url(#end)")
            .style(style.pathLink)
        ;
        path.exit().remove();
        let node = d3graphNodes.selectAll("g.node")
            .data(this.force.nodes(), d => d.id)
        ;
        let nodeEnter = node.enter()
            .append("g")
            .attr("class", "node")
            .on("click", d => {
                if (d3.event.defaultPrevented) return;
                this.selectNode(d);
            })
        ;
        nodeEnter.append("circle");
        nodeEnter.append("text")
            .attr("dy", "0.5ex")
            .attr("text-anchor", "middle")
            .text(d => d.name)
            .style(style.textUnder)
        ;
        nodeEnter.append("text")
            .attr("dy", "0.5ex")
            .attr("text-anchor", "middle")
            .text(d => d.name)
            .style(style.textOver)
        ;
        nodeEnter
            .call(this.force.drag)
        ;
        node.select("circle")
            .attr("r", d => d.r)
            .style(_.defaults(style.circle, {
                fill: d => d.colour,
                stroke: d => (_.includes(this.props.selected, d.id)) ? "black" : "white"
            }))
        ;
        node.exit().remove();

        // Handle line curves and constrain nodes
        function tick() {
            node.attr("transform", d => {
                //d.x = Math.max(R_MAX, Math.min(W - R_MAX, d.x));
                //d.y = Math.max(R_MAX, Math.min(H - R_MAX, d.y));
                return "translate(" + d.x + "," + d.y + ")";
            });
            path.attr("d", d => {
                let midX = (d.source.x + d.target.x) / 2;
                let midY = (d.source.y + d.target.y) / 2;
                return "M" +
                    d.source.x + "," +
                    d.source.y + "L" +
                    midX + "," +
                    midY + "L" +
                    d.target.x + "," +
                    d.target.y
                ;
            });
        }
    }

    componentWillUnmount() {
        this.force.stop();
    }

    render() {
        let style = {
            chart: {
                width: this.props.width,
                height: this.props.height,
                backgroundColor: "white"
            },
            control: {
                position: "absolute",
                left: 0,
                bottom: 0
            }
        };

        //switch (this.props.layout.mode) {
        switch (this.props.instrument.mode) {
            case "error":
                //TODO: detailed error
                return <p>ERROR</p>;
                break;
            //case "modal":
            //    // Like normal display, but uses a lightbox mode to show more.
            //    break;
            default:
                // Normal mode, showing the plot with what data we have.
                return <div>
                    <svg
                        ref="chart"
                        style={style.chart}
                    >
                        <defs>
                            <marker ref="marker" id="end">
                                <path ref="markerPath" ></path>
                            </marker>
                        </defs>
                        <g ref="graphContainer" >
                            <rect ref="graphBackground" ></rect>
                            <g ref="graphEdges" ></g>
                            <g ref="graphNodes" ></g>
                        </g>
                    </svg>
                    <div style={style.control}>
                        <ButtonGroup>
                            <Button
                                onClick={this.resetZoom}
                            >Reset pan/zoom</Button>
                        </ButtonGroup>
                    </div>
                </div>;
        }
    }

    resetZoom = () => {
        let d3graphContainer = d3.select(ReactDOM.findDOMNode(this.refs.graphContainer));
        this.unrenderedState.zoom.translate([0, 0]).scale(1);
        this.unrenderedState.zoom.event(d3graphContainer);
    };

    fetchDetails = (selected, related) => {
        // Fetch details for the selected and related ids.

        let ids = selected.concat(related);

        if (!ids) {
            this.setState({
                graph: []
            });
            return;
        }

        let url = `http://localhost:3000/graph-by-id?ids=` + ids.join(",");
        fetch(url)
            .then(response => response.json())
            .then(json => {
                // Merge old and new graph, so we preserve layout where it exists already.
                let oldGraph = this.state.graph
                    .filter(d => _.includes(ids, d.id))
                    .map(d => _.pick(d, ["id", "x", "y", "px", "py"]))
                ;
                let graph = [];
                for (let node of json) {
                    graph.push(_.defaults(node, _.find(oldGraph, { id: node.id })));
                }

                this.setState({
                    graph
                });
            })
        ;
    };

    selectNode = node => {
        if (_.includes(this.props.selected, node.id)) {
            this.props.actionFetchSelection(_.difference(this.props.selected, [node.id]));
        }
        else {
            this.props.actionFetchSelection(this.props.selected.concat([node.id]));
        }
    };
}


/*
 Exports
 */

export default Instrument;

