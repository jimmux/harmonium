#!/usr/bin/env bash

# Assuming neo4j has been installed to ~/bin/neo4j

# Build and run conversion script
npm install
npm run build
node dist/convert_panama.js download ~/bin/neo4j/import

cd ~/bin/neo4j

# Clear out the old data, if it exists.
echo Removing old data...
bin/neo4j stop
rm -Rf data/databases/graph.db/*

# Use the import tool on generated csv files
bin/neo4j-import --into data/databases/graph.db --bad-tolerance 100000001 --id-type STRING \
    --skip-bad-relationships true --skip-duplicate-nodes true --ignore-extra-columns true --multiline-fields true \
    --nodes:Country import/n_country.csv \
    --nodes:ISO3 import/n_iso3.csv \
    --nodes:ISO2 import/n_iso2.csv \
    --nodes:Location import/n_location.csv \
    --relationships:encodes import/r_country_iso3.csv \
    --relationships:encodes import/r_country_iso2.csv \
    --relationships:capital import/r_location_iso2.csv \
    --nodes:Identity import/n_identity.csv \
    --nodes:Officer import/n_officer.csv \
    --nodes:Intermediary import/n_intermediary.csv \
    --relationships:for import/r_intermediary_for_identity.csv \
    --relationships:shareholder_of import/r_identity_shareholder_identity.csv \
    --relationships:beneficiary_of import/r_identity_beneficiary_identity.csv \
    --relationships:secretary_of import/r_identity_secretary_identity.csv \
    --relationships:director_of import/r_identity_director_identity.csv \
    --relationships:trust_settlor_of import/r_identity_trust_identity.csv \
    --relationships:beneficial_owner_of import/r_identity_owner_identity.csv \
    --relationships:jurisdiction import/r_identity_jurisdiction_iso3.csv \
    --relationships:from import/r_identity_from_iso3.csv \
    --relationships:from import/r_officer_from_iso3.csv \
    --relationships:from import/r_intermediary_from_iso3.csv \
    --nodes:WB_IncomeGroup import/n_wb_incomegroup.csv \
    --nodes:WB_GFDD_Indicator import/n_wb_gfddindicator.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2000.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2001.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2002.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2003.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2004.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2005.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2006.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2007.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2008.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2009.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2010.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2011.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2012.csv \
    --nodes:WB_GFDD_Measure import/n_wb_gfddmeasure_2013.csv \
    --relationships:classified_as import/r_iso3_classified_as_wb_incomegroup.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2000.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2001.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2002.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2003.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2004.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2005.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2006.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2007.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2008.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2009.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2010.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2011.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2012.csv \
    --relationships:measured_as import/r_iso3_measured_as_wb_gfddmeasure_2013.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2000_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2001_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2002_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2003_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2004_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2005_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2006_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2007_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2008_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2009_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2010_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2011_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2012_for_indicator_wb_gfddindicator.csv \
    --relationships:for_indicator import/r_wb_gfddmeasure_2013_for_indicator_wb_gfddindicator.csv \
    --nodes:Region import/n_region.csv \
    --relationships:child import/r_region_child_region.csv \
    --relationships:child import/r_region_child_country.csv \
    --nodes:Meta:Entity import/n_meta_entity.csv \
    --nodes:Meta:Attribute import/n_meta_attribute.csv \
    --relationships:has import/r_meta_node_attribute.csv \
    --nodes:Meta:Note import/n_note.csv \
    --relationships:selects import/r_note_selects_country.csv

bin/neo4j start

cd -


