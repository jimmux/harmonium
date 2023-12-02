// React imports
import React, {Component, PropTypes} from "react";

class Point extends Component {

    static defaultProps = {
        r: 2,
        cx: 0,
        cy: 0,
        selected: false,
        fill: "black"
    };

    render() {

        let style = {
            circle: {
                strokeWidth: 0,
                fill: this.props.fill
            }
        };

        return <g>
            <circle
                r={this.props.r}
                cx={this.props.cx}
                cy={this.props.cy}
                style={style.circle}
            />
        </g>;
    }
}


export default {
    Point
};
