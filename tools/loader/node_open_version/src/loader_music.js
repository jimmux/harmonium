/**
 * Created by jmanley on 22/01/16.
 */

import neo4j from "node-neo4j";
import _ from "lodash";
import sqlite3 from "sqlite3";
import "babel-polyfill";    

if (process.argv.length < 3) {
    console.log('Usage: node ' + process.argv[1] + ' DIRECTORY');
    process.exit(1);
}
const DIRECTORY = process.argv[2];
const LIMIT = 100; // Set to -1 for no limit. 1,000 - 10,000 is reasonable.

console.log("Importing from: " + DIRECTORY);

let neo = new neo4j(`http://${config.neo4j.user}:${config.neo4j.password}@${config.neo4j.ip}:${config.neo4j.port}`);
let limitClause = (LIMIT >= 0) ? "limit " + LIMIT : "";


/*
    Can use a generalised promise to transfer data from sqlite to neo4j
 */

let promiseSqliteToNeo = (dbPath, dbQuery, neoQuery) => new Promise((resolve, reject) => {
    let db = new sqlite3.Database(dbPath);
    db.serialize();
    let countRead;
    let countWritten = 0;

    let doRow = (err, row) => {
        if (err) {
            console.log(err);
            return;
        }

        let statements = {
            statements: [{
                statement: neoQuery,
                parameters: row
            }]
        };
        neo.beginAndCommitTransaction(statements, (error, result) => {
            if (error) {
                reject(`Could not write to Neo4j: ${error}`);
            }
            else {
                // Only finish if this is the last row to write
                countWritten++;
                if (countWritten === countRead) {
                    resolve(countWritten);
                }
            }
        });
    };

    let doEndRows = (error, count) => {
        db.close();
        if (error) {
            reject(`Could not read from DB: ${error}`);
        }
        else {
            if (count < 1) {
                resolve(count);
            }
            else {
                // Don't finish yet, there are probably still writes to neo4j happening
                countRead = count;
            }
        }
    };

    db.each(dbQuery, doRow, doEndRows);
});


/*
    Extract from metadata
 */
let dbPathMetadata = DIRECTORY + "/millionsong/track_metadata.db";

// Base artist data queries
let dbArtistQuery = `
    select
        s.artist_id msid,
        s.artist_mbid mbid,
        s.artist_name name,
        s.artist_familiarity familiarity,
        s.artist_hotttnesss hotttnesss
    from songs s
    ${limitClause}
`;
let neoArtistQuery = `
    merge (a:Artist {msid: {msid}})
    on create set
        a.mbid = {mbid},
        a.name = {name},
        a.familiarity = {familiarity},
        a.hotttnesss = {hotttnesss}
`;

// Base song data queries
let dbSongQuery = `
    select
        s.track_id track_id,
        s.title title,
        s.song_id song_id,
        s.release release,
        s.artist_id artist_id,
        s.duration duration,
        s.year year,
        s.track_7digitalid track_7digitalid,
        s.shs_perf,
        s.shs_work
    from songs s
    ${limitClause}
`;
let neoSongQuery = `
    match (a:Artist {msid: {artist_id}})
    merge (a)-[:performed]->(s:Song {msid: {song_id}})
    on create set
        s.track_id = {track_id},
        s.name = {title},
        s.release = {release},
        s.artist_id = {artist_id},
        s.duration = {duration},
        s.year = {year},
        s.track_7digitalid = {track_7digitalid},
        s.shs_perf = {shs_perf},
        s.shs_work = {shs_work}
`;


/*
    Extract from artist_term.db
*/
let dbPathTerms = DIRECTORY + "/millionsong/artist_term.db";

// Get mbtags
let dbTagQuery = `
    select
        artist_id,
        mbtag
    from artist_mbtag
`;
let neoTagQuery = `
    match (a:Artist {msid: artist_id})
    merge (a)-[:tagged]->(t:Tag {name: {mbtag}})
`;

// Get terms
let dbTermQuery = `
    select
        artist_id,
        term
    from artist_term
`;
let neoTermQuery = `
    match (a:Artist {msid: artist_id})
    merge (a)-[:labelled]->(t:Term {name: {term}})
`;

/* Add similarity relationships from artist_similarity.db */

/* Add locations from artist_location.txt */

/* Add user listening counts from train_triplets.txt */

// Run transfer queries.
promiseSqliteToNeo(dbPathMetadata, dbArtistQuery, neoArtistQuery)
    .then(count => {
        console.log(`Loaded ${count} artists from ${dbPathMetadata}.`);
        return promiseSqliteToNeo(dbPathMetadata, dbSongQuery, neoSongQuery);
    })
    .then(count => {
        console.log(`Loaded ${count} songs from ${dbPathMetadata}.`);
        return promiseSqliteToNeo(dbPathTerms, dbTagQuery, neoTagQuery);
    })
    .then(count => {
        console.log(`Loaded ${count} terms from ${dbPathTerms}.`);
        return promiseSqliteToNeo(dbPathTerms, dbTermQuery, neoTermQuery);
    })
    .then(count => {
        console.log(`Loaded ${count} tags from ${dbPathTerms}.`);
    })
    .catch(error => console.log(`Import failed: ${error}`))
;


