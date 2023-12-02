/**
 * Created by jmanley on 22/01/16.
 */

import neo4j from "node-neo4j";
import _ from "lodash";
import lineByLine from "n-readlines";
import "babel-polyfill";


if (process.argv.length < 3) {
    console.log('Usage: node ' + process.argv[1] + ' FILENAME');
    process.exit(1);
}
const FILENAME = process.argv[2];
const LIMIT = 5000; // Set to -1 for no limit. 1,000 - 10,000 is reasonable.

const reComment = /^#/;
const reId = /^Id:\s+([0-9]+)/;
const reAsin = /^ASIN:\s+(.+)/;
const reTitle = /^\s+title:\s+(.+)/;
const reGroup = /^\s+group:\s+(.+)/;
const reRank = /^\s+salesrank:\s+([0-9]+)/;
const reSimilar = /^\s+similar:\s+[0-9]+\s+(.+)/;
const reCategoriesCount = /^\s+categories:\s+([0-9]+)/;
const reReviewsCount = /^\s+reviews:\s+total:\s+[0-9]+\s+downloaded:\s+([0-9]+)\s+avg rating:\s+[0-9]+/;


console.log("Importing from: " + FILENAME);

let lineReader = new lineByLine(FILENAME);
let neo = new neo4j(`http://${config.neo4j.user}:${config.neo4j.password}@${config.neo4j.ip}:${config.neo4j.port}`);


function writeProduct(product) {
    let {
        source_id,
        title,
        categories,
        reviews,
        asin,
        group,
        salesrank,
        similar
    } = product;

    title = title || "";
    categories = categories || [];
    reviews = reviews || [];
    group = group || "N/A";
    salesrank = salesrank || null;
    similar = similar || [];

    //TODO: Too many reviews causes an overflow error. Do in their own queries.
    reviews = reviews.slice(0, 50);

    // Similar products may not exist yet, so we need to create placeholders for them
    let mergeProductClause = similar.map((d, i) => `
        with product
        merge (product_${i}:Product {asin: "${d}"})
        with product, product_${i}
        create (product)-[:similar]->(product_${i})
    `).join(" ");

    let mergeReviewsClause = reviews.map((d, i) => `
        with product
        merge (customer:Customer {source_id: "${d.customer}"})
        with product, customer
        create (product)-[:reviewed]->(review:Review {
            year: ${d.year},
            month: ${d.month},
            day: ${d.day},
            rating: ${d.rating},
            votes: ${d.votes},
            helpful: ${d.helpful}
        })-[:by]->(customer)
    `).join(" ");

    let query = `
        merge (product:Product {asin: {asin}})
        set
            product.title = {title},
            product.source_id = {source_id},
            product.salesrank = {salesrank}
        ${mergeProductClause}
        ${mergeReviewsClause}
        with product
        merge (group:Group {name: {group}})
        with product, group
        create (product)-[:in]->(group)
    ;`;

    return new Promise(function(resolve, reject) {
        neo.cypherQuery(
            query,
            {
                source_id,
                title,
                asin,
                salesrank,
                group
            },
            (error, result) => {
                if (error) {
                    reject(`Could not write product with ID ${source_id} ("${title}") to DB: ${error}`);
                }
                else {
                    resolve(result);
                }
            }
        );
    });

}


async function parseData() {

    let product;
    let countProducts = 0;
    let countCategories = 0;
    let countReviews = 0;

    let remaining = LIMIT;

    let rawLine;
    while (rawLine = lineReader.next()) {
        let line = rawLine.toString("ascii");

        // Process possible comment line
        if (reComment.test(line)) {
            continue;
        }

        let result;

        // If we're in a category parsing mode, handle the line as a category path
        if (countCategories > 0) {
            countCategories--;

            let reCategory = /\|([^\|]+)\[([0-9]+)]/g;
            let category = [];
            while (result = reCategory.exec(line)) {
                category.push({
                    name: result[1],
                    id: result[2]
                });
            }

            if (category.length === 0) continue;

            product.categories.push(category);
            continue;
        }

        // If we're in a review parsing mode, handle the line as a review
        if (countReviews > 0) {
            countReviews--;

            let reReview = /([0-9]+)-([0-9]+)-([0-9]+)\s+cutomer:\s+([\w]+)\s+rating:\s+([0-9]+)\s+votes:\s+([0-9]+)\s+helpful:\s+([0-9]+)/;
            result = reReview.exec(line);
            product.reviews.push({
                year: parseInt(result[1]),
                month: parseInt(result[2]),
                day: parseInt(result[3]),
                customer: result[4],
                rating: parseInt(result[5]),
                votes: parseInt(result[6]),
                helpful: parseInt(result[7])
            });
            continue;
        }


        // If not in category or review parsing mode, grab details for the current product

        result = reId.exec(line);
        if (result) {
            // Starting a new product, so the old product can be written to DB.
            if (product) {
                try {
                    let response = await writeProduct(product);
                }
                catch (error) {
                    console.log(error);
                    break;
                }
                if (++countProducts % 1000 === 0) console.log(`Stored ${countProducts} products (${product.title}).`);
                if (--remaining === 0) break;
            }

            product = {
                source_id: result[1],
                categories: [],
                reviews: []
            };
            continue;
        }

        result = reAsin.exec(line);
        if (result) {
            product.asin = result[1];
            continue;
        }

        result = reTitle.exec(line);
        if (result) {
            product.title = result[1];
            continue;
        }

        result = reGroup.exec(line);
        if (result) {
            product.group = result[1];
            continue;
        }

        result = reRank.exec(line);
        if (result) {
            product.salesrank = parseInt(result[1]);
            continue;
        }

        result = reSimilar.exec(line);
        if (result) {
            product.similar = result[1].split(" ").filter(d => d.length > 0);
            continue;
        }

        result = reCategoriesCount.exec(line);
        if (result) {
            // Next line(s) will be category paths
            countCategories = parseInt(result[1]);
            continue;
        }

        result = reReviewsCount.exec(line);
        if (result) {
            // Next line(s) will be category paths
            countReviews = parseInt(result[1]);
            continue;
        }


    }

    return new Promise(function(resolve, reject) {
        resolve("Parse of text data complete.");
    });
}


async function buildGraph() {
    let response = await parseData();
    console.log(response);

    // Also needs metadata
    neo.cypherQuery(
        `
            create
                // Entities
                (eProduct:Meta:Entity {name: "Product"}),
                (eCategory:Meta:Entity {name: "Category", type: "tree"}),
                (eCustomer:Meta:Entity {name: "Customer"}),
                (eReview:Meta:Entity {name: "Review"}),
                (eGroup:Meta:Entity {name: "Group"}),
                // Attributes
                (aYear:Meta:Attribute {name: "year", type: "integer"}),
                (aMonth:Meta:Attribute {name: "month", type: "integer"}),
                (aDay:Meta:Attribute {name: "day", type: "integer"}),
                (aRating:Meta:Attribute {name: "rating", type: "integer"}),
                (aVotes:Meta:Attribute {name: "votes", type: "integer"}),
                (aHelpful:Meta:Attribute {name: "helpful", type: "integer"}),
                (aSalesrank:Meta:Attribute {name: "salesrank", type: "integer"}),
                (aSourceId:Meta:Attribute {name: "source_id", type: "string"}),
                (aAsin:Meta:Attribute {name: "asin", type: "string"}),
                (aName:Meta:Attribute {name: "name", type: "string"}),
                (aTitle:Meta:Attribute {name: "title", type: "string"}),
                // Entity -> Attribute
                (eProduct)-[:has]->(aSourceId),
                (eProduct)-[:has]->(aAsin),
                (eProduct)-[:has]->(aTitle),
                (eCategory)-[:has]->(aSourceId),
                (eCategory)-[:has]->(aName),
                (eCustomer)-[:has]->(aSourceId),
                (eReview)-[:has]->(aYear),
                (eReview)-[:has]->(aMonth),
                (eReview)-[:has]->(aDay),
                (eReview)-[:has]->(aRating),
                (eReview)-[:has]->(aVotes),
                (eReview)-[:has]->(aHelpful),
                (eGroup)-[:has]->(aName)
        `,
        (error, result) => {
            if (error) {
                console.log(Error("Could not make metadata: " + error));
            }
            else {
                console.log("Metadata done.");
            }
        }
    );

    // Clean up the placeholder products that never got details
    neo.cypherQuery(
        `
            match (n:Product)-[r]-()
            where n.title is null
            delete r, n
        `,
        (error, result) => {
            if (error) {
                console.log(Error("Could not remove placeholder products: " + error));
            }
            else {
                console.log("Placeholder products removed.");
            }
        }
    );
}



// Clear existing data, then begin import by parsing the text file.
neo.cypherQuery(
    `
        match (n)-[r]-()
        delete r, n
    `,
    (error, result) => {
        if (error) {
            console.log(Error("Could not delete existing data: " + error));
        }
        else {

            neo.cypherQuery(
                `
                    match (n)
                    delete n
                `,
                (error, result) => {
                    if (error) {
                        console.log(Error("Could not delete existing data: " + error));
                    }
                    else {
                        buildGraph();
                    }
                }
            );

        }
    }
);

