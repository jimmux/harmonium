/**
 * Created by jmanley on 22/01/16.
 */

import sqlite3 from "sqlite3";
import "babel-polyfill";    // For async/await
import fs from "fs";
import csv from "csv-write-stream";
import lineByLine from "n-readlines";


if (process.argv.length < 3) {
    console.log('Usage: node ' + process.argv[1] + ' DIRECTORY_FROM');
    process.exit(1);
}
const DIRECTORY_FROM = process.argv[2];
const DIRECTORY_TO = process.argv[3];
const LIMIT = -1; // Set to -1 for no limit. 1,000 - 10,000 is reasonable.


console.log(`Importing from ${DIRECTORY_FROM} to ${DIRECTORY_TO}`);
try {
    fs.mkdirSync(DIRECTORY_TO);
}
catch (error) {
    // Whatever, already got the directory
}

let limitClause = (LIMIT >= 0) ? "limit " + LIMIT : "";


/*
    Can use generalised promises to transfer data from sqlite or text to neo4j
 */

let promiseSqliteToCsv = (dbPath, dbQuery, outfile) => new Promise((resolve, reject) => {

    let db = new sqlite3.Database(dbPath);
    db.serialize();
    let writer = csv({
        // separator: ";"
    });
    writer.pipe(fs.createWriteStream(outfile));

    let countRead;
    let countWritten = 0;

    let doRow = (error, row) => {
        if (error) {
            reject(`Bad row: ${error}`);
        }
        else {
            writer.write(row);
            countWritten++;
            if (countWritten === countRead) {
                writer.end();
            }
        }
    };

    let doEndRows = (error, count) => {
        db.close();
        if (error) {
            reject(`Could not read from DB: ${error}`);
        }
        else {
            countRead = count;
            if (count < 1 || countWritten === countRead) {
                resolve(count);
            }
        }
    };

    db.each(dbQuery, doRow, doEndRows);
});

let promiseTextToCsv = (textPath, outfile, headers = [], separator = ",", convert = o => o ) => new Promise((resolve, reject) => {
    let writer = csv({
        headers
    });
    try {
        writer.pipe(fs.createWriteStream(outfile));
        let lineReader = new lineByLine(textPath);
        let line;
        let c = 0;
        while (line = lineReader.next()) {
            c++;
            writer.write(convert(line.toString("ascii").split(separator)));
        }
        resolve(c);
    }
    catch (error) {
        reject(`Error converting ${textPath}: ${error}`);
    }
    finally {
        writer.end();
    }
});


/*
    Extract from metadata
 */
let pathMetadata = DIRECTORY_FROM + "/millionsong/track_metadata.db";

// Base artist data query
let artistQuery = `
    select
        s.artist_id "id:ID(artist)",
        s.artist_mbid "mbid:string",
        s.artist_name "name:string",
        s.artist_familiarity "familiarity:float",
        s.artist_hotttnesss "hotttnesss:float"
    from songs s
    group by s.artist_id
    ${limitClause}
`;

// Base song data query
let songQuery = `
    select
        s.song_id "id:ID(song)",
        s.title "name:string",
        s.shs_work "shs_work:int"
    from songs s
    group by s.song_id
    ${limitClause}
`;

// Base track data query
let trackQuery = `
    select
        s.track_id "id:ID(track)",
        s.duration "duration:float",
        s.track_7digitalid "7digitalid",
        s.shs_perf "shs_perf:int"
    from songs s
    group by s.track_id
    ${limitClause}
`;

// Base release data query
let releaseQuery = `
    select
        s.artist_id || " " || s.release "id:ID(release)",
        s.release "name:string"
    from songs s
    group by s.artist_id || " " || s.release
    ${limitClause}
`;

// Base year data query
let yearQuery = `
    select
        s.year "id:ID(year)",
        strftime("%s", s.year || "-01-01") "datetime:int"
    from songs s
    group by s.year
    ${limitClause}
`;

// Join artists to releases
let joinArtistReleaseQuery = `
    select
        s.artist_id ":START_ID(artist)",
        s.artist_id || " " || s.release ":END_ID(release)"   
    from songs s
    group by s.artist_id || " " || s.release
    ${limitClause}
`;

// Join releases to years
let joinReleaseYearQuery = `
    select
        s.artist_id || " " || s.release ":START_ID(release)",
        s.year ":END_ID(year)"   
    from songs s
    group by s.artist_id || " " || s.release
    ${limitClause}
`;

// Join releases to tracks
let joinReleaseTrackQuery = `
    select
        s.artist_id || " " || s.release ":START_ID(release)",
        s.track_id ":END_ID(track)"   
    from songs s
    group by s.track_id
    ${limitClause}
`;

// Join tracks to songs
let joinTrackSongQuery = `
    select
        s.track_id ":START_ID(track)",
        s.song_id ":END_ID(song)"   
    from songs s
    group by s.track_id
    ${limitClause}
`;


/*
    Extract from artist_term.db
*/
let pathTerms = DIRECTORY_FROM + "/millionsong/artist_term.db";

// Get mbtags
let tagQuery = `
    select
        mbtag "name:ID(tag)"
    from artist_mbtag
    group by mbtag
`;

// Get terms
let termQuery = `
    select
        term "name:ID(term)"
    from artist_term
    group by term
`;

// Get the relationships
let joinArtistTag = `
    select
        m.artist_id ":START_ID(artist)",
        m.mbtag ":END_ID(tag)"   
    from artist_mbtag m
    ${limitClause}
`;
let joinArtistTerm = `
    select
        t.artist_id ":START_ID(artist)",
        t.term ":END_ID(term)"   
    from artist_term t
    ${limitClause}
`;


/* Add similarity relationships from artist_similarity.db */

let pathSimilarArtist = DIRECTORY_FROM + "/millionsong/artist_similarity.db";
let joinSimilarArtistQuery = `
    select
        s.target ":START_ID(artist)",
        s.similar ":END_ID(artist)"   
    from similarity s
    ${limitClause}
`;


/* Add locations from artist_location.txt */
let pathLocation = DIRECTORY_FROM + "/millionsong/artist_location.txt";
let locationSeparator = "<SEP>";
let locationNodeHeaders = ["id:ID(location)", "geo_point:float[]", "name:string"];
let locationJoinHeaders = [":START_ID(artist)", ":END_ID(location)"];
let locationNodeConvert = ([artistId, lat, lon, artistName, locationName]) => [`${lat}_${lon}`, `${lat};${lon}`, locationName];
let locationJoinConvert = ([artistId, lat, lon, artistName, locationName]) => [artistId, `${lat}_${lon}`];


/* Add year to songs - as entity to support filtering */
/*
let pathyear = DIRECTORY_FROM + "/millionsong/tracks_per_year.txt";
let yearSeparator = "<SEP>";
let yearNodeHeaders = ["id:ID(year)", "timestamp:int", "name:string"];
let yearJoinHeaders = [":START_ID(track)", ":END_ID(year)"];
let yearNodeConvert = ([year, trackId, artistName, trackName]) => [year, (new Date(year, 1, 1)).getTime(), year];
let yearJoinConvert = ([year, trackId, artistName, trackName]) => [trackId, year];
*/


/* Add user listening counts from train_triplets.txt */
// Use provided txt version.

/*
    Add MusicBrainz data and connect using the the MBID we already have.
    To make this work with the import tool, we need to read all the MBIDs from the millionsong metadata again,
    and match these as we read in MusicBrainz data.
 */


// Run transfer queries.
promiseSqliteToCsv(pathMetadata, artistQuery, DIRECTORY_TO + "/n_artist.csv")
    .then(count => {
        console.log(`Loaded ${count} artists from ${pathMetadata}.`);
        return promiseSqliteToCsv(pathMetadata, songQuery, DIRECTORY_TO + "/n_song.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} songs from ${pathMetadata}.`);
        return promiseSqliteToCsv(pathMetadata, trackQuery, DIRECTORY_TO + "/n_track.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} tracks from ${pathMetadata}.`);
        return promiseSqliteToCsv(pathMetadata, releaseQuery, DIRECTORY_TO + "/n_release.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} releases from ${pathMetadata}.`);
        return promiseSqliteToCsv(pathMetadata, yearQuery, DIRECTORY_TO + "/n_year.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} years from ${pathMetadata}.`);
        return promiseSqliteToCsv(pathMetadata, joinArtistReleaseQuery, DIRECTORY_TO + "/r_artistRelease.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} artist-release connections from ${pathMetadata}.`);
        return promiseSqliteToCsv(pathMetadata, joinReleaseYearQuery, DIRECTORY_TO + "/r_releaseYear.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} release-year connections from ${pathMetadata}.`);
        return promiseSqliteToCsv(pathMetadata, joinReleaseTrackQuery, DIRECTORY_TO + "/r_releaseTrack.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} release-track connections from ${pathMetadata}.`);
        return promiseSqliteToCsv(pathMetadata, joinTrackSongQuery, DIRECTORY_TO + "/r_trackSong.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} track-song connections from ${pathMetadata}.`);
        return promiseSqliteToCsv(pathSimilarArtist, joinSimilarArtistQuery, DIRECTORY_TO + "/r_similarArtist.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} similar artist connections from ${pathSimilarArtist}.`);
        return promiseSqliteToCsv(pathTerms, tagQuery, DIRECTORY_TO + "/n_tags.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} terms from ${pathTerms}.`);
        return promiseSqliteToCsv(pathTerms, termQuery, DIRECTORY_TO + "/n_terms.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} tags from ${pathTerms}.`);
        return promiseSqliteToCsv(pathTerms, joinArtistTag, DIRECTORY_TO + "/r_artistTag.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} tag-artist connections from ${pathTerms}.`);
        return promiseSqliteToCsv(pathTerms, joinArtistTerm, DIRECTORY_TO + "/r_artistTerm.csv");
    })
    .then(count => {
        console.log(`Loaded ${count} term-artist connections from ${pathTerms}.`);
        return promiseTextToCsv(
            pathLocation,
            DIRECTORY_TO + "/n_locations.csv",
            locationNodeHeaders,
            locationSeparator,
            locationNodeConvert
        );
    })
    .then(count => {
        console.log(`Loaded ${count} locations from ${pathLocation}.`);
        return promiseTextToCsv(
            pathLocation,
            DIRECTORY_TO + "/r_artistLocations.csv",
            locationJoinHeaders,
            locationSeparator,
            locationJoinConvert
        );
    })
    .then(count => {
        console.log(`Loaded ${count} location-artist connections from ${pathLocation}.`);
        console.log("DONE");
    })
    .catch(error => console.log(`Import failed: ${error}`))
;


