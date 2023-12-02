/**
 * Created by jmanley on 22/01/16.
 */

import fs from "fs";
import csv from "csv";


if (process.argv.length < 3) {
    console.log('Usage: node ' + process.argv[1] + ' DIRECTORY_FROM');
    process.exit(1);
}
const DIRECTORY_FROM = process.argv[2];
const DIRECTORY_TO = process.argv[3];

const FROM_YEAR = 2000;     // Data is available back to 1960, but more than we need
const TO_YEAR = 2013;


console.log(`Importing from ${DIRECTORY_FROM} to ${DIRECTORY_TO}`);
try {
    fs.mkdirSync(DIRECTORY_TO);
}
catch (error) {
    // Whatever, already got the directory
}


function convertCSV(
    inFile,
    outFile,
    colsFromHeader,
    rowTransform,
    delimiter = ",",
    comment = undefined,
    quote = '"'
) {
    let stream = fs.createReadStream(inFile);
    stream.on("end", () => console.log(`Converted ${inFile} to ${outFile}`));
    stream
        .pipe(csv.parse({
            delimiter,
            comment,
            quote,
            skip_empty_lines: true,
            trim: true,
            relax: true,
            relax_column_count: true,
            columns: !!colsFromHeader || undefined      // A bit weird, but needs undefined to ignore header row
        }))
        .pipe(csv.transform(rowTransform))      // If colsFromHeader, map {} -> {}, else [] -> {}
        .pipe(csv.stringify({
            header: true
        }))
        .pipe(fs.createWriteStream(outFile))
    ;
}


/*
    Extract from geonames
*/
let geonamesPath = DIRECTORY_FROM + "/geonames";
let geonamesDelimiter = "\t";
let geonamesComment = "#";

// Country
convertCSV(
    geonamesPath + "/countryInfo.txt",
    DIRECTORY_TO + "/n_country.csv",
    false,
    record => ({
        "source_id:ID(country)": record[2],
        "name:string": record[4],
        "capital:string": record[5],
        "area:float": record[6],
        "population:int": record[7],
        "continent:string": record[8],
        "tld:string": record[9],
        "currency_code:string": record[10],
        "currency_name:string": record[11]
    }),
    geonamesDelimiter,
    geonamesComment
);

// ISO3 and ISO2 country codes need to be own entities, so we can join where this is the only common index
convertCSV(
    geonamesPath + "/countryInfo.txt",
    DIRECTORY_TO + "/n_iso3.csv",
    false,
    record => ({
        "source_id:ID(iso3)": record[1]
    }),
    geonamesDelimiter,
    geonamesComment
);
convertCSV(
    geonamesPath + "/countryInfo.txt",
    DIRECTORY_TO + "/n_iso2.csv",
    false,
    record => ({
        "source_id:ID(iso2)": record[0]
    }),
    geonamesDelimiter,
    geonamesComment
);

// Locations, to start just link capitals as locations to their country
// Later we can try linking addresses
convertCSV(
    geonamesPath + "/cities15000.txt",
    DIRECTORY_TO + "/n_location.csv",
    false,
    record => ({
        "source_id:ID(location)": record[0],
        "name:string": record[1],
        "geo_point:float[]": `${record[4]};${record[5]}`
    }),
    geonamesDelimiter,
    geonamesComment
);

// Join Location to ISO2
convertCSV(
    geonamesPath + "/cities15000.txt",
    DIRECTORY_TO + "/r_location_iso2.csv",
    false,
    record => {
        // Empty record (ignored) if not a national capital - TODO: more accurate detection of addresses
        if (record[7] === "PPLC") {
            return {
                ":START_ID(location)": record[0],
                ":END_ID(iso2)": record[8]
            };
        }
        else {
            return null;
        }
    },
    geonamesDelimiter,
    geonamesComment
);

// Join Country to ISOs
convertCSV(
    geonamesPath + "/countryInfo.txt",
    DIRECTORY_TO + "/r_country_iso2.csv",
    false,
    record => ({
        ":START_ID(iso2)": record[0],
        ":END_ID(country)": record[2]
    }),
    geonamesDelimiter,
    geonamesComment
);
convertCSV(
    geonamesPath + "/countryInfo.txt",
    DIRECTORY_TO + "/r_country_iso3.csv",
    false,
    record => ({
        ":START_ID(iso3)": record[1],
        ":END_ID(country)": record[2]
    }),
    geonamesDelimiter,
    geonamesComment
);

//TODO: Add a NameVariant node, to help address matching


/*
 Extract from panama papers
 */
let panamaPath = DIRECTORY_FROM + "/panama/offshore_leaks_csvs-20160513";
let panamaDelimiter = ",";

// Identity
convertCSV(
    panamaPath + "/Entities.csv",
    DIRECTORY_TO + "/n_identity.csv",
    true,
    record => ({
        "source_id:ID(panama)": record.node_id,
        "name:string": record.name,
        "address:string": record.address,
        "status:string": record.status     //TODO: convert to entity, along with source, service_provider
    }),
    panamaDelimiter
);

// Officers
convertCSV(
    panamaPath + "/Officers.csv",
    DIRECTORY_TO + "/n_officer.csv",
    true,
    record => ({
        "source_id:ID(panama)": record.node_id,
        "name:string": record.name,
    }),
    panamaDelimiter
);

// Intermediary
convertCSV(
    panamaPath + "/Intermediaries.csv",
    DIRECTORY_TO + "/n_intermediary.csv",
    true,
    record => ({
        "source_id:ID(panama)": record.node_id,
        "name:string": record.name,
        "address:string": record.address,
        "status:string": record.status     //TODO: convert to entity, along with source
    }),
    panamaDelimiter
);

// Join panama internal data
convertCSV(
    panamaPath + "/all_edges.csv",
    DIRECTORY_TO + "/r_intermediary_for_identity.csv",
    true,
    record => {
        if (record.rel_type.toLowerCase() === "intermediary of") {
            return {
                ":START_ID(panama)": record.node_1,
                ":END_ID(panama)": record.node_2
            };
        }
        else {
            return null;
        }
    },
    panamaDelimiter
);
convertCSV(
    panamaPath + "/all_edges.csv",
    DIRECTORY_TO + "/r_identity_shareholder_identity.csv",
    true,
    record => {
        if (record.rel_type.toLowerCase() === "shareholder of") {
            return {
                ":START_ID(panama)": record.node_1,
                ":END_ID(panama)": record.node_2
            };
        }
        else {
            return null;
        }
    },
    panamaDelimiter
);
convertCSV(
    panamaPath + "/all_edges.csv",
    DIRECTORY_TO + "/r_identity_beneficiary_identity.csv",
    true,
    record => {
        if (record.rel_type.toLowerCase() === "beneficiary of") {
            return {
                ":START_ID(panama)": record.node_1,
                ":END_ID(panama)": record.node_2
            };
        }
        else {
            return null;
        }
    },
    panamaDelimiter
);
convertCSV(
    panamaPath + "/all_edges.csv",
    DIRECTORY_TO + "/r_identity_secretary_identity.csv",
    true,
    record => {
        if (record.rel_type.toLowerCase() === "secretary of") {
            return {
                ":START_ID(panama)": record.node_1,
                ":END_ID(panama)": record.node_2
            };
        }
        else {
            return null;
        }
    },
    panamaDelimiter
);
convertCSV(
    panamaPath + "/all_edges.csv",
    DIRECTORY_TO + "/r_identity_director_identity.csv",
    true,
    record => {
        if (record.rel_type.toLowerCase() === "director of") {
            return {
                ":START_ID(panama)": record.node_1,
                ":END_ID(panama)": record.node_2
            };
        }
        else {
            return null;
        }
    },
    panamaDelimiter
);
convertCSV(
    panamaPath + "/all_edges.csv",
    DIRECTORY_TO + "/r_identity_trust_identity.csv",
    true,
    record => {
        if (record.rel_type.toLowerCase() === "trust settlor of") {
            return {
                ":START_ID(panama)": record.node_1,
                ":END_ID(panama)": record.node_2
            };
        }
        else {
            return null;
        }
    },
    panamaDelimiter
);
convertCSV(
    panamaPath + "/all_edges.csv",
    DIRECTORY_TO + "/r_identity_owner_identity.csv",
    true,
    record => {
        if (record.rel_type.toLowerCase() === "beneficial owner of") {
            return {
                ":START_ID(panama)": record.node_1,
                ":END_ID(panama)": record.node_2
            };
        }
        else {
            return null;
        }
    },
    panamaDelimiter
);



/*
 Extract from world bank income groups
 */
let wbIncomeGroupPath = DIRECTORY_FROM + "/worldbank/API_CM.MKT.LDOM.NO_DS2_en_csv_v2";
let wbIncomeGroupDelimiter = ",";
let wbIncomeGroupMap = {
    "High income: OECD": 1.0,
    "High income: nonOECD": 0.75,
    "Upper middle income": 0.5,
    "Lower middle income": 0.25,
    "Low income": 0.0
};

// Income Group
convertCSV(
    wbIncomeGroupPath + "/Metadata_Country_API_CM.MKT.LDOM.NO_DS2_en_csv_v2.csv",
    DIRECTORY_TO + "/n_wb_incomegroup.csv",
    true,
    record => {
        if (!record.IncomeGroup) {
            return null;
        }
        else {
            return {
                "source_id:ID(wb_incomegroup)": record.IncomeGroup,
                "name:string": record.IncomeGroup,
                "amount:float": wbIncomeGroupMap[record.IncomeGroup]
            };
        }
    },
    wbIncomeGroupDelimiter
);


/*
 Extract from world bank Global Financial Development data (GFDD)
 */
let wbGfddPath = DIRECTORY_FROM + "/worldbank/GFDD_csv";
let wbGfddDelimiter = ",";

// Indicator details
convertCSV(
    wbGfddPath + "/GFDD_Series.csv",
    DIRECTORY_TO + "/n_wb_gfddindicator.csv",
    true,
    record => {
        if (!record["Series Code"]) {
            return null;
        }
        else {
            let periodicity = record["Periodicity"].split("-").map(parseInt);
            let startDate = periodicity[0] || FROM_YEAR;       // Earliest year on record
            let endDate = periodicity[1] || TO_YEAR;         // Latest year on record.
            return {
                "source_id:ID(wb_gfddindicator)": record["Series Code"],
                "name:string": record["Indicator Name"],
                "topic:string": record["Topic"],        //TODO: Could be own entity
                "description:string": record["Short definition"],       //TODO: Include long definition?
                "start_date:long": (new Date(startDate, 0, 0)).getTime(),
                "end_date:long": (new Date(endDate, 0, 0)).getTime(),
                "aggregation_method:string": record["Aggregation method"],
                "source:string": record["Source"]      //TODO: Could also be own entity
            };
        }
    },
    wbGfddDelimiter
);

// GFDD measurement
// This one is a bit special, as it has to be repeated for each available year from FROM_YEAR to TO_YEAR
for (let year = FROM_YEAR; year <= TO_YEAR; year++) {
    let yearString = year.toString();
    convertCSV(
        wbGfddPath + "/GFDD_Data.csv",
        DIRECTORY_TO + `/n_wb_gfddmeasure_${yearString}.csv`,
        true,
        record => {
            if (!record[yearString]) {
                return null;
            }
            else {
                return {
                    "source_id:ID(wb_gfddmeasure)": `${record["Indicator Code"]}_${record["Country Code"]}_${yearString}`,
                    "amount:float": record[yearString],
                    "date:long": (new Date(yearString, 0, 0)).getTime()
                };
            }
        },
        wbGfddDelimiter
    );
}





/*
 Join data from different sources
 */

// Join Identity to ISO3 via jurisdiction and country_codes
//TODO: country_codes can be a list of codes
convertCSV(
    panamaPath + "/Entities.csv",
    DIRECTORY_TO + "/r_identity_jurisdiction_iso3.csv",
    true,
    record => {
        if (record.jurisdiction === "XXX") {
            return null;
        }
        else {
            return {
                ":START_ID(panama)": record.node_id,
                ":END_ID(iso3)": record.jurisdiction
            };
        }
    },
    panamaDelimiter
);
convertCSV(
    panamaPath + "/Entities.csv",
    DIRECTORY_TO + "/r_identity_from_iso3.csv",
    true,
    record => {
        if (!record.country_codes) {
            return null;
        }
        else {
            return {
                ":START_ID(panama)": record.node_id,
                ":END_ID(iso3)": record.country_codes
            };
        }
    },
    panamaDelimiter
);

// Join Officer to ISO3 via country_codes
convertCSV(
    panamaPath + "/Officers.csv",
    DIRECTORY_TO + "/r_officer_from_iso3.csv",
    true,
    record => {
        if (!record.country_codes) {
            return null;
        }
        else {
            return {
                ":START_ID(panama)": record.node_id,
                ":END_ID(iso3)": record.country_codes
            };
        }
    },
    panamaDelimiter
);

// Join Intermediary to ISO3 via country_codes
convertCSV(
    panamaPath + "/Intermediaries.csv",
    DIRECTORY_TO + "/r_intermediary_from_iso3.csv",
    true,
    record => {
        if (!record.country_codes) {
            return null;
        }
        else {
            return {
                ":START_ID(panama)": record.node_id,
                ":END_ID(iso3)": record.country_codes
            };
        }
    },
    panamaDelimiter
);

// Join worldbank income group to ISO3
convertCSV(
    wbIncomeGroupPath + "/Metadata_Country_API_CM.MKT.LDOM.NO_DS2_en_csv_v2.csv",
    DIRECTORY_TO + "/r_iso3_classified_as_wb_incomegroup.csv",
    true,
    record => {
        if (!record.IncomeGroup) {
            return null;
        }
        else {
            return {
                ":START_ID(iso3)": record["Country Code"],
                ":END_ID(wb_incomegroup)": record.IncomeGroup
            };
        }
    },
    wbIncomeGroupDelimiter
);

// Join worldbank development measurement to indicator detail and ISO3
// This one is a bit special, as it has to be repeated for each available year from FROM_YEAR to TO_YEAR
for (let year = FROM_YEAR; year <= TO_YEAR; year++) {
    let yearString = year.toString();
    // ISO3 to measure
    convertCSV(
        wbGfddPath + "/GFDD_Data.csv",
        DIRECTORY_TO + `/r_iso3_measured_as_wb_gfddmeasure_${yearString}.csv`,
        true,
        record => {
            if (!record[yearString]) {
                return null;
            }
            else {
                return {
                    ":START_ID(iso3)": record["Country Code"],
                    ":END_ID(wb_gfddmeasure)": `${record["Indicator Code"]}_${record["Country Code"]}_${yearString}`
                };
            }
        },
        wbGfddDelimiter
    );
    // Measure to indicator detail
    convertCSV(
        wbGfddPath + "/GFDD_Data.csv",
        DIRECTORY_TO + `/r_wb_gfddmeasure_${yearString}_for_indicator_wb_gfddindicator.csv`,
        true,
        record => {
            if (!record[yearString]) {
                return null;
            }
            else {
                return {
                    ":START_ID(wb_gfddmeasure)": `${record["Indicator Code"]}_${record["Country Code"]}_${yearString}`,
                    ":END_ID(wb_gfddindicator)": record["Indicator Code"]
                };
            }
        },
        wbGfddDelimiter
    );
}



/*
 Manual data
 */

// Region
// Must be able to match with countries, producing a hierarchy of Planet -> Continent -> Country
const MANUAL_NODE_REGION = `name:ID(region),pretty:string
AF,Africa
AS,Asia
EA,Earth
EU,Europe
NA,North America
OC,Oceania
SA,South America
`;
fs.writeFile(DIRECTORY_TO + "/n_region.csv", MANUAL_NODE_REGION, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Manual node data for regions saved.");
});
const MANUAL_RELATIONSHIP_REGION = `:START_ID(region),:END_ID(region)
EA,AF
EA,AS
EA,EU
EA,NA
EA,OC
EA,SA
`;
fs.writeFile(DIRECTORY_TO + "/r_region_child_region.csv", MANUAL_RELATIONSHIP_REGION, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Manual relationship data for regions saved.");
});
// Join to countries
convertCSV(
    geonamesPath + "/countryInfo.txt",
    DIRECTORY_TO + "/r_region_child_country.csv",
    false,
    record => ({
        ":START_ID(region)": record[8],
        ":END_ID(country)": record[2]
    }),
    geonamesDelimiter,
    geonamesComment
);



/*
 Metadata
 */

const META_NODE = `name:ID(meta_entity),type:string
Country,node
Region,node
ISO3,node
ISO2,node
Location,node
Identity,node
Officer,node
Intermediary,node
WB_IncomeGroup,node
WB_GFDD_Indicator,node
WB_GFDD_Measure,node
`;
fs.writeFile(DIRECTORY_TO + "/n_meta_entity.csv", META_NODE, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Metadata for entities saved.");
});

const META_ATTRIBUTE = `name:ID(meta_attribute),type:string
source_id,string
name,string
pretty,string
geo_point,vector2d
capital,string
area,float
population,integer
continent,string
tld,string
currency_code,string
currency_name,string
address,string
status,string
amount,float
topic,string
description,string
date,datetime
start_date,datetime
end_date,datetime
aggregation_method,string
source,string
`;
fs.writeFile(DIRECTORY_TO + "/n_meta_attribute.csv", META_ATTRIBUTE, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Metadata for attributes saved.");
});

const META_NODE_ATTRIBUTE = `:START_ID(meta_entity),:END_ID(meta_attribute)
Country,source_id
Country,name
Country,capital
Country,area
Country,population
Country,continent
Country,tld
Country,currency_code
Country,currency_name
Region,name
Region,pretty
ISO3,source_id
ISO2,source_id
Location,source_id
Location,name
Location,geo_point
Identity,source_id
Identity,name
Identity,address
Identity,status
Officer,source_id
Officer,name
Intermediary,source_id
Intermediary,name
Intermediary,address
Intermediary,status
WB_IncomeGroup,source_id
WB_IncomeGroup,name
WB_IncomeGroup,amount
WB_GFDD_Indicator,source_id
WB_GFDD_Indicator,name
WB_GFDD_Indicator,topic
WB_GFDD_Indicator,description
WB_GFDD_Indicator,start_date
WB_GFDD_Indicator,end_date
WB_GFDD_Indicator,aggregation_method
WB_GFDD_Indicator,source
WB_GFDD_Measure,source_id
WB_GFDD_Measure,amount
WB_GFDD_Measure,date
`;
fs.writeFile(DIRECTORY_TO + "/r_meta_node_attribute.csv", META_NODE_ATTRIBUTE, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Metadata join saved.");
});



/*
 Notes
 */

const NOTE_NODE = `:ID(note),store_id:int,name:string,description:string,path:string,view:string,protected:boolean
0,0,Australia,Simple select on Australia,"ISO2,encodes,Country,encodes,ISO3","{}",true
1,1,Regional income groups,Quick view of regional distribution among World Bank income groups,"Region,child,Region,child,Country,encodes,ISO3,classified_as,WB_IncomeGroup","{\\"instruments\\":[{\\"type\\":\\"notes\\",\\"id\\":\\"1\\",\\"config\\":{},\\"mode\\":\\"grid\\",\\"entities\\":[],\\"title\\":\\"\\"},{\\"type\\":\\"graphER\\",\\"id\\":\\"2\\",\\"config\\":{},\\"mode\\":\\"grid\\",\\"entities\\":[],\\"title\\":\\"\\"},{\\"type\\":\\"graphSelected\\",\\"id\\":\\"3\\",\\"config\\":{},\\"mode\\":\\"config\\",\\"entities\\":[],\\"title\\":\\"\\"},{\\"type\\":\\"icicle\\",\\"id\\":\\"4\\",\\"config\\":{\\"entity\\":\\"Region\\"},\\"mode\\":\\"grid\\",\\"entities\\":[\\"Region\\"],\\"title\\":\\"Region\\"}],\\"layout\\":[{\\"i\\":\\"1\\",\\"x\\":0,\\"y\\":0,\\"h\\":2,\\"w\\":2,\\"moved\\":false},{\\"i\\":\\"2\\",\\"x\\":0,\\"y\\":4,\\"h\\":2,\\"w\\":2,\\"moved\\":false},{\\"i\\":\\"3\\",\\"x\\":2,\\"y\\":0,\\"h\\":4,\\"w\\":4,\\"moved\\":false},{\\"i\\":\\"4\\",\\"x\\":0,\\"y\\":2,\\"h\\":2,\\"w\\":2,\\"moved\\":false}]}",true
`;
fs.writeFile(DIRECTORY_TO + "/n_note.csv", NOTE_NODE, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Note nodes saved.");
});

const NOTE_RELATIONSHIP_COUNTRY = `:START_ID(note),:END_ID(country)
0,036
`;
fs.writeFile(DIRECTORY_TO + "/r_note_selects_country.csv", NOTE_RELATIONSHIP_COUNTRY, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("Note relationships saved.");
});




