#!/usr/bin/env bash

# Easiest way to use neo4j is local install at ~/bin/neo4j, includes tools not in other releases
mkdir -p ~/bin
cd ~/bin
wget -O /tmp/neo4j.tar.gz https://neo4j.com/artifact.php?name=neo4j-community-3.0.6-unix.tar.gz
gunzip /tmp/neo4j.tar.gz
tar -xvf /tmp/neo4j.tar
ln -sfn neo4j-community-3.0.6 neo4j
cd -

cat >./generated_config.js <<-EOF
let config = {
    neo4j: {
        ip: "127.0.0.1",
        port: "7474",
        user: "neo4j",
        password: "Zna41016"
    }
};

export default config;
EOF


# Manual setup of Neo4j:
#echo To initialise Neo4j, go to http://$(docker inspect --format '{{ .NetworkSettings.IPAddress }}' neo4j):7474/browser/ and change login to neo4j / Zna41016
#echo Neo4j available at $(docker inspect --format '{{ .NetworkSettings.IPAddress }}' neo4j):7474/browser/ with login neo4j/Zna41016
echo
echo Start neo4j with:
echo "    ~/bin/neo4j/bin/neo4j start"
echo
echo Neo4j available at 127.0.0.1:7474/browser/
echo May need one-time set of login to neo4j/Zna41016
echo
echo To import sample data, cd to tools/loader/node_open_version and execute:
echo "    npm install"
echo "    npm run build"
echo "    npm run convert_panama"
echo "    npm run load_panama"

