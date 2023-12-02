import d3 from "d3";
import neo4j from "node-neo4j";
import _ from "lodash";

import config from "../../../generated_config.js";

let neo = new neo4j(`http://${config.neo4j.user}:${config.neo4j.password}@${config.neo4j.ip}:${config.neo4j.port}`);

fetchLabels();


function fetchLabels() {
    neo.cypherQuery(
        `match (n)
        where not "Meta" in labels(n)
        unwind labels(n) as label
        return distinct label, count(n)`,
        (error, result) => {
            if (error) {
                console.log("Could not get labels: " + error);
            }
            else {
                let labels = result.data;
                console.log("Got labels: " + labels.join(", ") + ".");
                fetchDataSync(labels);
            }
        }
    );
}


function fetchDataSync(labels) {
    if (labels.length < 1) {
        console.log("All labels fetched.");
        return;
    }

    let [label, count] = labels.pop();
    if (count > 10000) {
        console.log("Too many for label " + label + ", skipping.");
        fetchDataSync(labels);
    }
    else {
        console.log("Getting data for label: " + label);
        neo.cypherQuery(
            `match (n:${label})--(_)--(m:${label})
            where (id(n) > id(m)) and (not "Meta" in labels(n)) and (not "Meta" in labels(m))
            return id(n), id(m)`,
            (error, result) => {
                if (error) {
                    console.log("Could not get data: " + error);
                }
                else {
                    generateLayout(label, result.data);
                    fetchDataSync(labels);
                }
            }
        );
    }
}

function generateLayout(label, neighbours) {
    if (neighbours.length > 5000) {
        console.log("Too many for label " + label + ", skipping.");
        return;
    }
    else if (neighbours.length < 2) {
        console.log("Not enough for label " + label + ", skipping.");
        return;
    }
    console.log("Got data, making the layout for label " + label + "...");

    let nodeSet = new Set();
    let nodes = [];
    let links = [];
    let numReported = 0;
    neighbours.forEach(d => {
        d.forEach(d => {
            if (!nodeSet.has(d)) {
                nodeSet.add(d);
                nodes.push({
                    id: d
                });
            }
        });

        links.push({
            source: _.find(nodes, {id: d[0]}),
            target: _.find(nodes, {id: d[1]})
        });

        if ((nodes.length % 1000 === 0) && (nodes.length !== numReported)) {
            numReported = nodes.length;
            console.log("Processed at least " + nodes.length + " nodes for label " + label);
        }
    });

    console.log("Got all " + nodes.length + " neighbouring nodes for label " + label + ", making a layout...");
    let force = d3.layout.force()
            .nodes(nodes)
            .links(links)
            .start()
        ;
    force.on("end", () => publishLayout(label, force));
}


function publishLayout(label, force) {
    console.log("Layout generated for " + label + ", publishing back to Neo4j...");

    //TODO: Start by removing existing layouts, then add missing attributes using defaults.

    for (let node of force.nodes()) {
        neo.updateNode(node.id, { layout_x: node.x, layout_y: node.y }, function(err, success){
            if (err) console.log(err);

            if (success){
                console.log("Node ID " + node.id + " got layout.");
            } else {
                // node not found, hence not updated
            }
        });
    }
}
