# ARCHIVED

This repo was migrated/sanitised from bitbucket on 2023/11/29. 

Last prototype contribution for demonstration of concepts at Monash University was in 2016. 

Kept here for reference and possible use if future research requires, without updates. 

Original data has been removed, but instructions to obtain it can be found in tools/loader/node_open_version/download/get_data.txt.


# Install

## Ubuntu/Debian

This process will probably work on any Debian based distro, but has been confirmed on Linux Mint 18 and Ubuntu 16.04.

Go to the base directory, and execute:

```
sudo ./install_dependencies.sh
./setup_ubuntu
```

If the scripts finish successfully, follow the final instructions to start Neo4j and set up authentication.


# Load sample data set

In a Node.js command prompt, go to tools/loader/node_open_version.

Run `load_panama.sh`.


# Run Accordion

Ensure Neo4j has the correct credentials (set up above) and data is loaded.

Back in base directory, run `start.sh`.

Open browser to `localhost:8080`



# Creating new data

For Neo4j data to work in Accordion/Harmonium, it must be structured accordingly:
- Nodes representing entities are to have a single label that determines the entity type
- Relationships can have any name and properties are not used
- The single exception to relationship names is `child`, which is to only e used in directed trees
- Nodes of the same label should have the same set of attributes
- Some property names will get special treatment for display in Accordion. Some recognised property names are:
  - name
  - pretty
  - description
  - amount

A small amount of metadata must also be added to help Accordion interpret the graph. 

A good example of this can be observed by loading the example data and running the cypher query:
```
match (n:Meta) return n
```

## Meta Entity

For each label used on the nodes, there needs to be a node with both labels `Meta` and `Entity`. It must have the property `name`, with a value matching the label on corresponding nodes. It may also have the property `type`, which provides hints about structure. At present only a value of `tree` is recognised.

## Meta Attribute

For each attribute on data nodes, there needs to be a node with labels `Meta` and `Attribute`. These nodes are to have properties `name`, which matches the property name used on data nodes, and `type`. The `type` property can be one of:
- string
- integer
- datetime (a numeric timestamp)
- float
- vector2d (an array of 2 floats, mostly used for geographical coordinates)
- poly2d (an array of floats with even-numbered length, used for geographical areas, represents a series of points)
- currency (may also have an additional property `subtype`, with a value such as `aud` for Australian Dollars)

The expected attributes for a given node label are indicated by creating a relationship from meta-entity to meta-attribute, with the name `has`. E.g. if our data has entities for location, that all have a property for geographical point, we would need meta data with a cypher representation like:
```
(Meta:Entity {name: "Location"})-[:has]->(Meta:Attribute {name: "geo_point", type: "vector2d"})
```
This would allow Accordion to work with data nodes like:
```
(:Location {geo_point: [45.2, -32.1]})
```

## Meta Note

An optional addition is note data. The easiest way to see how these work is to create some notes using the Notes instrument in Accordion, then query Neo4j to see what they look like with:
```
match (n:Meta:Note)
optional match (n)-[r:selects]->()
return n, r
```

Notes can be used to store simple observations, along with selections, paths, and even view configuration. Manually created nodes can have the `protected` property set to true so they cannot be deleted in Accordion.


