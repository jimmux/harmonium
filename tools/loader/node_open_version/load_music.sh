#!/usr/bin/env bash

# Install prerequisites:
#sudo add-apt-repository ppa:openjdk-r/ppa
#sudo apt-get update
#sudo apt-get install openjdk-8-jdk
#sudo update-alternatives --config java
#sudo update-alternatives --config javac
#(select openjdk 8 as default)

# Download neo4j 3.0.0 to ~/bin/neo4j

cd ~/bin/neo4j

# Clear out the old data, if it exists.
echo Removing old data...
bin/neo4j stop
rm -Rf ~/bin/neo4j/data/databases/graph.db/*

# Use the import tool on generated csv files
bin/neo4j-import --into data/databases/graph.db --bad-tolerance 1000001 \
    --skip-bad-relationships true --skip-duplicate-nodes true --ignore-extra-columns true \
    --nodes:Artist import/n_artist.csv \
    --nodes:Song import/n_song.csv \
    --nodes:Track import/n_track.csv \
    --nodes:Release import/n_release.csv \
    --nodes:Year import/n_year.csv \
    --relationships:issued import/r_artistRelease.csv \
    --relationships:on import/r_releaseYear.csv \
    --relationships:contains import/r_releaseTrack.csv \
    --relationships:depicts import/r_trackSong.csv \
    --relationships:similar import/r_similarArtist.csv \
    --nodes:MusicBrainzTag import/n_tags.csv \
    --relationships:labelled import/r_artistTag.csv \
    --nodes:MillionSongTerm import/n_terms.csv \
    --relationships:labelled import/r_artistTerm.csv \
    --nodes:Location import/n_locations.csv \
    --relationships:from import/r_artistLocations.csv
bin/neo4j start

# Manual setup of Neo4j:
#echo Neo4j available at http://$(docker inspect --format '{{ .NetworkSettings.IPAddress }}' neo4j):7474/browser/ with login neo4j/Zna41016

cd -
