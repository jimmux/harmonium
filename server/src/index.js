import express from "express";
import neo4j from "node-neo4j";
import _ from "lodash";
import Request from "request";
import FeedParser from "feedparser";

import config from "./generated_config.js";


let app = express();
// Neo4j server at http://localhost:7474/db/data/cypher
let neo = new neo4j(`http://${config.neo4j.user}:${config.neo4j.password}@${config.neo4j.ip}:${config.neo4j.port}`);

//TODO: should use token based authentication, passed from client, for full security.

//TODO: handle bad requests better, return meaningful errors.


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/', function (req, res) {
    res.send(`
<p>Routes available:</p>
<ul>
    <li>/metadata</li>
    <li>/entity-summary/<em>label</em></li>
    <li>/entity-points/<em>label?a=name,min,max&a=name,min&..</em></li>
    <li>/point-relationships/<em>id/length</em></li>
</ul>
    `);
});


/*
    Metadata requests
 */

let promiseMetadataEntities = new Promise((resolve, reject) => {
    neo.cypherQuery(
        // Adding count is much slower, but should only happen at start and can help optimise later.
        `match (e:Meta:Entity)--(a:Meta:Attribute)
        optional match (n)
        where not "Meta" in labels(n)
        and e.name in labels(n)
        return e.name, collect(distinct a.name), count(distinct n)
        ;`,
        (error, result) => {
            if (error) {
                reject(Error("Could not get entity metadata: " + error));
            }
            else {
                let data = {};
                for (let row of result.data) {
                    data[row[0]] = {
                        pretty: null,
                        attributes: row[1],
                        count: row[2]
                    }
                }
                resolve(data);
            }
        }
    );
});

let promiseMetadataAttributes = new Promise((resolve, reject) => {
    /*
     <name>: {
         pretty:
         type:
         root: // Only for tree types, gives the id of tree root
         default:
     }
     */
    neo.cypherQuery(
        `match (a:Meta:Attribute)
        return a.name, a.type, a.subtype, a.root, a.default
        ;`,
        (error, result) => {
            if (error) {
                reject(Error("Could not get attribute metadata."));
            }
            else {
                let data = {};
                for (let row of result.data) {
                    data[row[0]] = {
                        pretty: null,
                        type: row[1],
                        subtype: row[2],
                        root: row[3],
                        default: row[4]
                    }
                }
                resolve(data);
            }
        }
    );
});

let promiseMetadataRelationships = new Promise((resolve, reject) => {
    /*
     <relationship>: {
         pretty:    //TODO
         shapes: [{
             count:
             from: label
             to: label
         }]
     }
     */
    neo.cypherQuery(
        `match (n)-[r]->(m)
        where (not "Meta" in labels(n)) and (not "Meta" in labels(m))
        return distinct type(r), count(r), head(labels(n)), head(labels(m))
        ;`,
        (error, result) => {
            if (error) {
                reject(Error("Could not get relationship metadata."));
            }
            else {
                let id = 0;
                let data = {};
                for (let row of result.data) {
                    let relationship = row[0];
                    let shape = {
                        id: id++,
                        count: row[1],
                        from: row[2],
                        to: row[3]
                    };
                    if (data[relationship]) {
                        data[relationship].shapes.push(shape);
                    }
                    else {
                        data[relationship] = {
                            pretty: null,    //TODO
                            shapes: [shape]
                        };
                    }
                }
                resolve(data);
            }
        }
    );
});
let promiseMetadataHierarchyRoots = new Promise((resolve, reject) => {
    /*
         <entity>: [
             {
                 id: ,
                 values: []
             },
             ...
         ]
     */
    //TODO: Don't assume they will have a "name" attribute, so get all attributes
    neo.cypherQuery(
        `match (n)-[:child]->()
        where not ()-[:child]->(n)
        return distinct labels(n), id(n), n.name
        ;`,
        (error, result) => {
            if (error) {
                reject(Error("Could not get hierarchy roots metadata: " + error));
            }
            else {
                let data = {};
                for (let row of result.data) {
                    let [labels, id, name] = row;
                    for (let label of labels) {
                        let root = {
                            id,
                            attributes: ["name"],
                            values: [name]
                        };
                        if (data[label]) {
                            data[label].push(root);
                        }
                        else {
                            data[label] = [root];
                        }
                    }
                }
                resolve(data);
            }
        }
    );
});


app.get("/metadata", (request, response) => {
    Promise
        .all([
            promiseMetadataEntities,
            promiseMetadataAttributes,
            promiseMetadataRelationships,
            promiseMetadataHierarchyRoots
        ])
        .then(results => {
            let [entities, attributes, relationships, hierarchyRoots] = results;

            // Determine the possible derived aggregate attributes from neighbours
            for (let key in entities) entities[key].aggregates = [];
            for (let r in relationships) {
                for (let shape of relationships[r].shapes) {
                    let entityFrom = entities[shape.from];
                    let entityTo = entities[shape.to];

                    for (let a of entityTo.attributes) {
                        //TODO: more, like average in 2d space?
                        switch (attributes[a].type) {
                            case "currency":
                                entityFrom.aggregates.push({
                                    f: "sum",
                                    entity: shape.to,
                                    path: [r],
                                    attribute: a
                                });
                                entityFrom.aggregates.push({
                                    f: "avg",
                                    entity: shape.to,
                                    path: [r],
                                    attribute: a
                                });
                                break;
                            // This won't work properly unless we store as timestamp. May need to change source data.
                            case "datetime":
                                entityFrom.aggregates.push({
                                    f: "min",
                                    entity: shape.to,
                                    path: [r],
                                    attribute: a
                                });
                                entityFrom.aggregates.push({
                                    f: "max",
                                    entity: shape.to,
                                    path: [r],
                                    attribute: a
                                });
                                break;
                        }
                    }
                    // And in the other direction...
                    for (let a of entityFrom.attributes) {
                        //TODO: more, like average in 2d space?
                        switch (attributes[a].type) {
                            case "currency":
                                entityTo.aggregates.push({
                                    f: "sum",
                                    entity: shape.from,
                                    path: [r],
                                    attribute: a
                                });
                                entityTo.aggregates.push({
                                    f: "avg",
                                    entity: shape.from,
                                    path: [r],
                                    attribute: a
                                });
                                break;
                            // This won't work properly unless we store as timestamp. May need to change source data.
                            case "datetime":
                                entityTo.aggregates.push({
                                    f: "min",
                                    entity: shape.from,
                                    path: [r],
                                    attribute: a
                                });
                                entityTo.aggregates.push({
                                    f: "max",
                                    entity: shape.from,
                                    path: [r],
                                    attribute: a
                                });
                                break;
                        }
                    }
                }
            }

            response.json({
                entities,
                attributes,
                relationships,
                hierarchyRoots
            });
        })
        .catch(error => console.error(error))
    ;
});

app.get("/entity-summary/:label" /* ?a=name&a=name&... */, (request, response) => {
    /*
    {
        count:
        extents: [{
            name:
            min:
            max:
        }]
    }
     */

    //TODO: Also work with multidimensional attributes like geopoint - looking easier to split out dimensions

    let label = request.params.label;
    let attributes = request.query.a;
    if (!(attributes instanceof Array)) attributes = [attributes];
    let cols = attributes.map(d => `{name: "${d}", min: min(n.\`${d}\`), max: max(n.\`${d}\`)}`).join(", ");

    let query = `match (n:\`${label}\`) return {count: count(n), extents: [${cols}]};`;

    neo.cypherQuery(
        query,
        (error, result) => {
            if (error) console.error(error);
            response.json(result.data[0]);
        }
    );
});


/*
 Actual data requests
 */
//TODO: Might need a way to fetch related ids given a label and attribute extents
// Probably needed when scaling up.

app.get("/entity-points/:label", (request, response) => {
    //TODO: Use params
    /* ?a=tag,name,truthy,min,max&a=name,truthy,min&...
        ?a is a list of attribute names with truthy and optional min,max values
        query: ?a=x,name,1,"a","m"&a=cost,0,5.2&a=y,geopoint,true,[-25.38,71.4],[-26.3,75.6]&...
        for points in [x, y] named a to m, cost over 5.2, in given area.
        Strings should be quoted.
        Truthy param indicates whether to include in response.
    */
    /* ?agg=tag,f,path,entity,attribute&agg=...
        ?agg is a list of aggregates to calculate
        query: ?agg=x,sum,at+Vendor+charge,Spend,amount&...
        gives: "include aggregate result for sum of 'amount' on Spends, via path at-Vendor-charge", tagged as x
        The f string must be an aggregate function supported by Neo4j, i.e. sum, count, avg, max, min, stdev, ...
     */

    /*
        {
            attributes: {
                y: name 1,
                z: name 2,
                ...
            },
            aggregates: {
                x: {
                    f: e.g. "sum",
                    entity: e.g. "Spend",
                    path: e.g. "at+Vendor+charge",
                    attribute: e.g. "amount"
                },
                ...
            }
            points: [
                {id: id, x: aggregate 1, y: attribute 1, z: attribute 2,...},
                {id: id, x: aggregate 1, y: attribute 1, z: attribute 2,...},
                ...
            ]
        }
     */

    /*
        Query example:

        match (_:label)
        where (_.attribute < max) and (_.attribute > min)
        with _
        match (_)-[path]-(end:entity)
        with _, f(end.attribute) as y
        match (_)-[path]-(end:entity)
        with _, y, f(end.attribute) as z
        return  id(_) as id, _.attribute as x, y, z
    */

    try {
        let label = request.params.label;

        let attributes = request.query.a;
        if (!attributes) attributes = [];
        if (!(attributes instanceof Array)) attributes = [attributes];
        attributes = attributes.map(d => {
            let [tag, name, answer, min, max] = d.split(",");
            return {tag, name, answer, min, max};
        });

        let aggregates = request.query.agg;
        if (!aggregates) aggregates = [];
        if (!(aggregates instanceof Array)) aggregates = [aggregates];
        aggregates = aggregates.map(d => {
            let [tag, f, pathString, entity, attribute] = d.split(",");
            //TODO: Split is actually encoded with "+", but express.js seems to sub with spaces.
            //TODO: Consider swapping for another character, like "/".
            let path = pathString.split(" ");
            return {tag, f, path, entity, attribute};
        });

        let whereClause = attributes
                .map(d => {
                    let clause = [];
                    if (typeof d.min !== "undefined") clause.push(`(_.\`${d.name}\` >= ${d.min})`);
                    if (typeof d.max !== "undefined") clause.push(`(_.\`${d.name}\` <= ${d.max})`);
                    return clause.join(" and ");
                })
                .filter(d => d.length)
                .join(" and ")
            ;
        if (whereClause.length) whereClause = "where " + whereClause;

        let matchAggregatesClause = aggregates.map((d, i) => {
            let path = d.path.map((d, i) => (i % 2) ? `(:${d})` : `[:${d}]`).join("-");
            let withTags = aggregates.slice(0, i).map(d => d.tag);
            withTags.push("_");
            withTags.push(`${d.f}(${d.entity}.${d.attribute}) as ${d.tag}`);
            return `match (_)-${path}-(${d.entity}:${d.entity}) with ${withTags.join(", ")}`;
        }).join(" ");


        let returnAttributes = attributes.filter(d => stringIsTruthy(d.answer));
        let returnClause = returnAttributes.map(d => `\`${d.tag}\`: _.\`${d.name}\``);
        returnClause.unshift("id: id(_)");
        returnClause = returnClause.concat(aggregates.map(d => `\`${d.tag}\`: ${d.tag}`));
        returnClause = "return {" + returnClause.join(", ") + "}";

        let query = `match (_:${label}) ${whereClause} with _ ${matchAggregatesClause} ${returnClause}`;

        neo.cypherQuery(
            query,
            (error, result) => {
                if (error) console.error(error);
                response.json({
                    attributes: returnAttributes.reduce((acc, d) => {
                        acc[d.tag] = d.name;
                        return acc;
                    }, {}),
                    aggregates: aggregates.reduce((acc, d) => {
                        acc[d.tag] = d;
                        return acc;
                    }, {}),
                    points: result.data
                });
            }
        );
    }
    catch (e) {
        console.error(e);
    }

});

app.get("/entity-points-by-id/:label" /* ?ids=id,id,id */, (request, response) => {
    /*
     [
         {
             attr_1: val_1,
             attr_2: val_2,
             ...
         },
         ...
     ]
     */
    try {
        let label = request.params.label;
        let ids = request.query.ids.split(",").map(d => +d);
        let query = `
        match (n:${label})
        where id(n) in {ids}
        return distinct n
    `;

        neo.cypherQuery(
            query,
            {ids},
            (error, result) => {
                if (error) console.error(error);
                response.json(result.data);
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/entity-all/:label", (request, response) => {
    /*
     [
         {
             attr_1: val_1,
             attr_2: val_2,
             ...
         },
            ...
     ]
     */
    try {
        let label = request.params.label;
        let query = `
        match (n:${label})
        return distinct n
    `;

        neo.cypherQuery(
            query,
            (error, result) => {
                if (error) console.error(error);
                response.json(result.data);
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/points-by-id" /* ?ids=id,id,id */, (request, response) => {
    /*
     [
         {
             entity: label,
             attributes: [attr_1, attr_2, ...]
             points: [
                [val_1, val_2, ...],
                [val_1, val_2, ...],
                ...
             ]
             ...
         },
         ...
     ]
     */

    try {

        let ids = request.query.ids.split(",").map(d => +d);

        let query = `
        match (n)
        where id(n) in {ids}
        unwind labels(n) as label
        return distinct {entity: label, attributes: keys(n), points: collect(n), ids: collect(id(n))}
    `;
        neo.cypherQuery(
            query,
            {ids},
            (error, result) => {
                if (error) console.error(error);
                let simplified = result.data.map(d => {
                    d.attributes = _.sortBy(d.attributes);
                    d.points = d.points.map(p => d.attributes.map(d => p.data[d]));
                    return d;
                });
                response.json(_.sortBy(simplified, "entity"));
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/related-by-path" /* ?path=node,edge,node,...&ids=id,id,id,... */, (request, response) => {
    /*
        [ids...]
     */

    try {
        let path = request.query.path.split(",");
        let ids = request.query.ids.split(",").map(d => +d);

        if ((path.length < 3) || (ids.length < 1)) {
            response.json([]);
            return;
        }

        let pathString = path.map((d, i) => (i % 2) ? `[:${d}]` : `(:${d})`).join("-");

        let query = `
        match p = ${pathString}
        where any (n in nodes(p) where (id(n) in {ids}))
        unwind nodes(p) as n
        with distinct n
        where not id(n) in {ids}
        return distinct id(n)
    `;

        neo.cypherQuery(
            query,
            {ids},
            (error, result) => {
                if (error) console.error(error);
                response.json(result.data);
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/related-by-tree" /* ?edges=from,relation,to;from,relation,to;...&ids=id,id,id,... */, (request, response) => {

    try {
        let edges = request.query.edges.split(";").map(d => {
            let [nFrom, r, nTo] = d.split(",");
            return {
                nFrom,
                r,
                nTo
            }
        });
        let nodes = _.uniq(edges.map(d => d.nFrom).concat(edges.map(d => d.nTo)));
        let ids = request.query.ids.split(",").map(d => +d);

        if ((edges.length < 1) || (ids.length < 1)) {
            response.json([]);
            return;
        }

        // E.g. from URL http://<server>:3000/related-by-tree?edges=OrgPosition,child,BusinessUnit;BusinessUnit,incur,Spend&ids=2840
        /*
         match
         (n0:OrgPosition),
         (n1:BusinessUnit),
         (n2:Spend),
         (n3:Category),
         (n4:Vendor),
         (n0)-[:child]->(n1),
         (n1)-[:incur]->(n2),
         (n3)-[:contains]->(n2),
         (n4)-[:charge]->(n2)
         where any (n in [n0, n1, n2, n3, n4] where id(n) in {ids})
         unwind [n0, n1, n2, n3, n4] as n
         with distinct n
         where not id(n) in {ids}
         return distinct id(n)
         */

        let nodeString = nodes.map(d => `(${d}:${d})`);
        let edgeString = edges.map(d => `(${d.nFrom})-[:${d.r}]->(${d.nTo})`);
        let matchString = nodeString.concat(edgeString).join(",");
        let nodeVarString = nodes.join(", ");

        let query = `
        match ${matchString}
        where any (n in [${nodeVarString}] where id(n) in {ids})
        unwind [${nodeVarString}] as n
        with distinct n
        where not id(n) in {ids}
        return id(n)
    `;

        neo.cypherQuery(
            query,
            {ids},
            (error, result) => {
                if (error) console.error(error);
                response.json(result.data);
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/hierarchy/:entity", (request, response) => {
    //TODO: Take a param for attribute to return as identifier (currently defaults to "name").
    // Child ids may be for different types of entity, but they willnot be in the results.
    /*
        [
            {
                id:
                name:
                children: [ids...]
            },
            ...
        ]
     */
    try {
        let entity = request.params.entity;

        let query = `
        match (n:${entity})-[:child]->(m)
        return distinct {id: id(n), name: n.name, children: collect(id(m))}
        ;`
            ;

        neo.cypherQuery(
            query,
            (error, result) => {
                if (error) console.error(error);
                response.json(result.data);
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/graph-by-id" /* ?ids=id,id,id */, (request, response) => {
    /*
         [
             [ids for length 0 (i.e. start id)],
             [ids for length 1],
             [ids for length 2],
             ...
         ]
     */
    try {
        if (!request.query.ids) {
            response.json([]);
            return;
        }

        let ids = request.query.ids.split(",").map(d => +d);
        let query = `
        match (n)
        where id(n) in { ids }
        and not "Meta" in labels(n)
        optional match (n)-->(m)
        where id(m) in { ids }
        and not "Meta" in labels(m)
        return {
            entity: head(labels(n)),
            node: n,
            id: id(n),
            related: collect(distinct id(m))
        }
    `;

        neo.cypherQuery(
            query,
            {ids},
            (error, result) => {
                if (error) console.error(error);
                for (let row of result.data) {
                    row.node = row.node.data;
                }
                response.json(result.data);
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});


/*
    Notes
 */
//TODO: Switch to using post for writing, as per: https://scotch.io/tutorials/use-expressjs-to-get-url-and-post-parameters.

app.get("/get-notes", (request, response) => {
    try {
        let query = `
        match (n:Note:Meta)
        optional match (n)-[:selects]->(m)
        return {
            id: n.store_id,
            name: n.name,
            description: n.description,
            path: n.path,
            view: n.view,
            selection: collect(id(m))
        }
        ;`
            ;

        neo.cypherQuery(
            query,
            (error, result) => {
                if (error) {
                    console.error(error);
                    response.json({});
                }
                else {
                    response.json(result.data);
                }
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/create-note", (request, response) => {
    //TODO: cleanse the data, check data types
    try {
        let name = decodeURIComponent(JSON.parse(request.query.name));
        let description = decodeURIComponent(JSON.parse(request.query.description));
        let selection = JSON.parse(request.query.selection);
        let view = request.query.view;
        let path = decodeURIComponent(request.query.path);
        let isProtected = !!JSON.parse(request.query.protected || false);

        let query;
        if (selection.length > 0) query = `
        match (n:Note:Meta)
        with coalesce(max(n.store_id), 0) + 1 as store_id
        create (n:Note:Meta {
            store_id: store_id,
            name: {name},
            description: {description},
            path: {path},
            view: {view},
            protected: {isProtected}
        })
        with n
        optional match (m)
        where id(m) in {selection}
		merge (n)-[:selects]->(m)
        return {id: n.store_id}
        ;`
        ;
        else query = `
        match (n:Note:Meta)
        with coalesce(max(n.store_id), 0) + 1 as store_id
        create (n:Note:Meta {
            store_id: store_id,
            name: {name},
            description: {description},
            path: {path},
            view: {view},
            protected: {isProtected}
        })
        return {id: n.store_id}
        ;`
        ;

        neo.cypherQuery(
            query,
            {
                name,
                description,
                path,
                selection,
                view,
                isProtected
            },
            (error, result) => {
                if (error) {
                    console.error(error);
                    response.json({});
                }
                else {
                    response.json(result.data);
                }
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/delete-note/:id", (request, response) => {
    //TODO: cleanse the data
    try {
        let id = +request.params.id;
        let query = `
        match (n:Note:Meta {store_id: {id}})
        where not n.protected = true
        with n
        optional match (n)-[r:selects]->()
        delete r, n
        ;`
            ;

        neo.cypherQuery(
            query,
            {id},
            (error, result) => {
                if (error) {
                    console.error(error);
                    response.json({});
                }
                else {
                    response.json(result.data);
                }
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/update-note-selection/:id", (request, response) => {
    //TODO: cleanse the data
    try {
        let id = +request.params.id;
        if (!request.query.s) {
            response.json({});
            return;
        }
        let selection = request.query.s;
        if (!selection) {
            selection = []
        }
        else {
            selection = JSON.parse(selection);
        }
        let query = `
        match (n:Note:Meta {store_id: {id}})
        where not n.protected = true
        optional match (n)-[r:selects]->()
        delete r
        with n
        match (m)
        where id(m) in {selection}
        merge (n)-[:selects]->(m)
    `;

        neo.cypherQuery(
            query,
            {
                id,
                selection
            },
            (error, result) => {
                if (error) {
                    console.error(error);
                    response.json({});
                }
                else {
                    response.json(result.data);
                }
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/update-note-view/:id", (request, response) => {
    try {
        let id = +request.params.id;
        let view = request.query.view || null;
        let query = `
        match (n:Note:Meta {store_id: {id}})
        where not n.protected = true
        set n.view = {view}
    `;

        neo.cypherQuery(
            query,
            {
                id,
                view
            },
            (error, result) => {
                if (error) {
                    console.error(error);
                    response.json({});
                }
                else {
                    response.json({});
                }
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/update-note-path/:id", (request, response) => {
    try {
        let id = +request.params.id;
        let path = request.query.path || null;
        let query = `
        match (n:Note:Meta {store_id: {id}})
        where not n.protected = true
        set n.path = {path}
        `;

        neo.cypherQuery(
            query,
            {
                id,
                path
            },
            (error, result) => {
                if (error) {
                    console.error(error);
                    response.json({});
                }
                else {
                    response.json({});
                }
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});

app.get("/get-note-view/:id", (request, response) => {
    try {
        let id = +request.params.id;
        let query = `
        match (n:Note:Meta {store_id: {id}})
        return n.view
    `;

        neo.cypherQuery(
            query,
            {
                id
            },
            (error, result) => {
                if (error) {
                    console.error(error);
                    response.json({});
                }
                else {
                    let view = result.data[0];
                    response.send(view);
                }
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});


/*
    Feed provider
 */
app.get("/feed/:maxArticles", (request, response) => {
    try {
        let count = +request.params.maxArticles;

        let rssRequest = Request("http://www.abc.net.au/local/rss/all.xml");
        let parser = new FeedParser({
            //normalize: false
        });

        let all = [];
        let sent = false;

        rssRequest.on("error", error => console.error(error));
        rssRequest.on("response", function (rssResponse) {
            let stream = this;
            if (rssResponse.statusCode != 200) return this.emit("error", new Error("Bad status code"));
            stream.pipe(parser);
        });

        parser.on("error", error => console.error(error));
        parser.on("readable", function () {
            let stream = this;
            let meta = this.meta;
            let item;

            while (null !== (item = stream.read())) {
                all.push({
                    title: item.title,
                    summary: item.summary,
                    image: item.image,
                    link: item.link,
                    guid: item.guid
                });
                count--;

                if (count < 0) end();
            }
        });
        parser.on("end", end);

        function end() {
            if (!sent) response.json(all);
            sent = true;
        }
    }
    catch (e) {
        console.error(e);
    }

});


/*
    Search
 */

app.get("/nodes-in-text"/*?a=pretty&a=name&text=...*/, (request, response) => {
    //TODO: cleanse the data
    try {
        let attributes = request.query.a;
        let text = decodeURIComponent(request.query.text);

        // Could use regular expressions, but this is faster.
        let whereClause = attributes
                .map(d => `(size(replace("${text}", n.${d}, "")) < ${text.length})`)
                .join(" or ")
            ;

        let query = `
        match (n)
        where ${whereClause}
        return {
            id: id(n),
            text: coalesce(${attributes.map(d => "n." + d).join(", ")}, "")
        }
    `;

        neo.cypherQuery(
            query,
            (error, result) => {
                if (error) {
                    console.error(error);
                    response.json({});
                }
                else {
                    response.json(result.data);
                }
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});


app.get("/search/:entity/:attribute/:skip/:limit", (request, response) => {
    //TODO: cleanse the data
    try {
        let entity = request.params.entity;
        let attribute = request.params.attribute;
        let limit = +request.params.limit;
        let skip = +request.params.skip;
        let search = decodeURIComponent(request.query.search).toLowerCase();

        if (entity === "*") entity = null;
        if ((!search || !attribute || +limit < 1)) {
            response.json([]);
            return;
        }

        let node = entity ? "_:" + entity : "_";
        let query = `
        match (${node})
        where not 'Meta' in labels(_)
        and lower(_.${attribute}) contains {search}
        return {
            id: id(_),
            entity: head(labels(_)),
            attribute: _.${attribute},
            node: _
        }
        skip {skip}
        limit {limit}
    `;

        neo.cypherQuery(
            query,
            {
                search,
                skip,
                limit
            },
            (error, result) => {
                if (error) {
                    console.error(error);
                    response.json([]);
                }
                else {
                    response.json(result.data.map(d => {
                        d.node = d.node.data;
                        return d;
                    }));
                }
            }
        );
    }
    catch (e) {
        console.error(e);
    }
});




/*
    Serve it up
 */

var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Listening at http://%s:%s', host, port);
});



/*
    Utils
 */

function stringIsTruthy(s) {
    try {
        return Boolean(JSON.parse(s));
    }
    catch (e) {
        return Boolean(s);
    }
}

