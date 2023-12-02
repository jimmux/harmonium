import React, {Component} from "react";
import ReactDOM from "react-dom";
import Router, {Location, Locations, Link} from "react-router-component";

// Redux
import thunkMiddleware from "redux-thunk";
import {createStore, applyMiddleware} from "redux";
import {Provider} from "react-redux";
import appState from "reducers";

// Components
import Upload from "components/upload";
import ControlPanelContainer from "containers/control-panel-container";

// Bootstrap
import "bootstrap/dist/css/bootstrap.min.css";

// Styling
import "react-resizable/css/styles.css";
import "react-grid-layout/css/styles.css";
//TODO: Split out into files for each components file, or use embedded styles within component.
import "stylesheets/style.css";

// Util
import _ from "lodash";


// Redux setup
let store = createStore(
    appState,
    _.flow(
        window.devToolsExtension ? window.devToolsExtension() : f => f,
        applyMiddleware(
            thunkMiddleware
        )
    )
);


class App extends Component {
    render() {
        // Preset layouts are possible via query string.
        // E.g. http://<server>/panel/<goes to props.preset>?<goes to props._query>

        // Need hash routing normally, or scripts aren't found and query string not found
        // (webpack gets the html template wrong).
        return <Locations hash>
            <Location path="/" handler={Loader} />
            <Location path="/upload" handler={Upload} />
            <Location path="/panel(/:preset)" handler={ControlPanelContainer} />
        </Locations>;
    }
}

class Loader extends Component {
    render() {
        let style = {
            color: "gray",
            backgroundColor: "white",
            margin: "2em",
            padding: "1em"
        };

        return (
            <div style={style}>
                <h4>Go to a preset configured panel</h4>
                <ul>
                    <li><Link href='/panel'>Empty</Link></li>
                    <li><Link href='/panel?viewId=1'>
                        Example: Regional income groups
                    </Link></li>
                    {/* TODO: add links like these (that work) to useful starting scenarios
                    <li><Link href='/panel?path=Feedback,complain_at,BusinessUnit'>
                        Search path: Feedback - complain_at - BusinessUnit
                    </Link></li>
                    <li><Link href='/panel?path=Category,contains,Spend,charge,Vendor'>
                        Search path: Category - contains - Spend - charge - Vendor
                    </Link></li>
                    */}
                </ul>
                <h4>Upload new data</h4>
                <Link href='/upload'>WORK IN PROGRESS: Upload Tool</Link>
            </div>
        );
    }
}

ReactDOM.render(
    <Provider store={store}>
        <App/>
    </Provider>,
    document.getElementById("top")
);
