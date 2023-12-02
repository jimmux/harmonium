#!/usr/bin/env bash

# Start neo4j
~/bin/neo4j/bin/neo4j restart

# Install dependencies as needed
npm install
# Run webpack and host server at http://localhost:3000/, client at http://localhost:8080/
npm run build
npm run start_server & npm run start_client

echo
echo Accordion is ready to run from localhost:8080
