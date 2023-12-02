import React, {Component, PropTypes} from "react";
import {
    Navbar,
    NavbarBrand,
    Nav,
    NavDropdown,
    NavItem,
    DropdownButton,
    MenuItem,
    Accordion,
    Panel,
    Button,
    Glyphicon,
    Modal,
    Input,
    ListGroup,
    ListGroupItem,
    OverlayTrigger,
    Popover
} from "react-bootstrap";

import Instrument, {NAME_MAP} from "components/instrument";

import _ from "lodash";

import {statusValue} from "symbols";


class MasterControl extends Component {

    constructor(props) {
        super(props);

        this.state = {
            search: {
                show: false,
                validSearchCriteria: [],     // List of {entity: name, attributes: []}, only containing searchable combinations.
                entityName: "",
                attributeName: "",
                searchText: "",
                results: []
            }
        };
    }

    componentWillReceiveProps(nextProps) {
        this.getValidSearchCriteria(nextProps);
    }

    componentDidMount() {
        this.getValidSearchCriteria(this.props);
    }

    render() {
        // Key property on Navbar seems to be necessary for VDOM to update the DOM when data has loaded
        return <Navbar staticTop key={status}>
            <NavbarBrand>{(this.props.status.value === statusValue.ready) ? "Accordion Mk II" : "Loading..."}</NavbarBrand>
            <Nav>
                <NavDropdown id="navbar-menu-configure" title="Configure">
                    <MenuItem header>Data</MenuItem>
                    <MenuItem
                        eventKey="reload"
                        disabled={true}
                    >Reload</MenuItem>
                    <MenuItem
                        eventKey="clearSelection"
                        disabled={this.props.selected.length < 1}
                        onSelect={() => this.props.actionClearSelection()}
                    >Clear Selection</MenuItem>
                </NavDropdown>
                <NavDropdown id="nav-menu-instrument" title="Instruments">
                    <MenuItem header >Add</MenuItem>
                    {this.getInstrumentMenuItems()}
                </NavDropdown>
            </Nav>
            <Nav>
                <NavItem onClick={() => this.showSearch()} >
                    <Glyphicon glyph="search" bsSize="medium"/>
                </NavItem>
                {this.getSearchModal()}
            </Nav>
        </Navbar>;
    }

    getSearchModal = () => {
        //TODO: modal body should probably be its own search component.
        let search = this.state.search;

        if (!search.validSearchCriteria.length) {
            // No valid search criteria available, don't do anything yet.
            return <Modal show={search.show} onHide={() => this.showSearch(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Search not available</Modal.Title>
                </Modal.Header>
                <Modal.Body>No searchable data has been loaded.</Modal.Body>
            </Modal>;
        }

        let attributesForEntity = search.validSearchCriteria.find(d => d.entityName === search.entityName).attributeNames;
        let popovers = search.results.map((result, i) => <Popover id={i} title={result.attribute}>
            {_.toPairs(result.node)
                .filter(([name, value]) => name !== search.attributeName)
                .map(([name, value]) => <p>{name + ": " + value}</p>)
            }
        </Popover>);

        return <Modal show={search.show} onHide={() => this.showSearch(false)}>
            <Modal.Header closeButton>
                <Modal.Title>Search</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Input
                    ref="selectEntity"
                    type="select"
                    label="Entity type"
                    defaultValue={search.entityName}
                    onChange={() => this.setSearchEntity(this.refs.selectEntity.getValue())}
                >
                    {search.validSearchCriteria.map(d =>
                        <option key={d.entityName} value={d.entityName}>
                            {d.entityName}
                        </option>
                    )}
                </Input>
                <Input
                    ref="selectAttribute"
                    type="select"
                    label="Attribute"
                    defaultValue={search.attributeName}
                    onChange={() => this.setSearchAttribute(this.refs.selectAttribute.getValue())}
                >
                    {attributesForEntity.map(d =>
                        <option key={d} value={d}>
                            {d}
                        </option>
                    )}
                </Input>
                <Input
                    ref="searchText"
                    type="text"
                    label="Search text"
                    value={search.searchText}
                    placeholder="Enter search text..."
                    onChange={this.search}
                />
                <ListGroup>
                    {search.results.map((d, i) => <OverlayTrigger key={i} trigger="hover" placement="right" overlay={popovers[i]}>
                        <ListGroupItem onClick={event => this.props.actionFetchSelection([d.id])} >
                            {d.attribute}
                        </ListGroupItem>
                    </OverlayTrigger>)}
                </ListGroup>

                <Button
                    onClick={() => {

                            }}
                    disabled={!search.attributeName}
                >Select</Button>
            </Modal.Body>
        </Modal>;
    };

    search = () => {
        let search = this.state.search;
        let text = this.refs.searchText.getValue();
        let url = `http://localhost:3000/search/${search.entityName}/${search.attributeName}/0/5?search=${text}`;

        fetch(url)
            .then(response => response.json())
            .then(json => {
                search.results = json;
                search.searchText = text;
                this.setState({ search });
            })
        ;
    };

    getValidSearchCriteria = props => {
        // Figure out the entities and attributes we can actually search with, using the metadata.
        let search = this.state.search;
        search.validSearchCriteria = [];
        for (let entityName in props.metadata.entities) {
            let entity = props.metadata.entities[entityName];
            let attributeNames = entity.attributes.filter(d => props.metadata.attributes[d].type === "string");
            if (attributeNames.length) {
                search.validSearchCriteria.push({
                    entityName,
                    attributeNames
                });
            }
        }

        if (search.validSearchCriteria.length) {
            if (!search.entityName) {
                search.entityName = search.validSearchCriteria[0].entityName;
            }
            let entity = search.validSearchCriteria.find(d => d.entityName === search.entityName);
            if (!search.attributeName || !_.includes(entity, search.attributeName)) {
                search.attributeName = entity.attributeNames[0];
            }
        }

        this.setState({ search });
    };

    getInstrumentMenuItems = () => {
        return _.keys(NAME_MAP).map(d =>
            <MenuItem
                key={d}
                eventKey={d}
                onSelect={(event, eventKey) => this.props.actionCreateInstrument(eventKey)}
            >
                {NAME_MAP[d]}
            </MenuItem>
        );
    };

    showSearch = (show = true) => {
        let search = this.state.search;
        search.show = show;
        this.setState({ search });
    };

    setSearchEntity = entityName => {
        let search = this.state.search;
        search.entityName = entityName;
        this.getValidSearchCriteria(this.props);
        this.setState({ search });
        this.search();
    };

    setSearchAttribute = attribute => {
        let search = this.state.search;
        search.attributeName = attribute;
        this.setState({ search });
        this.search();
    };
}

export default MasterControl;

