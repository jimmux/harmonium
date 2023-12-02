#!/usr/bin/env bash
# Install everything needed in a typical ubuntu/debian environment.
# May need partner repos enabled for Ubuntu.

# Run as root
if [ "$EUID" -ne 0 ]
    then echo "Must run as root. Goodbye."
    exit
fi

# Node:
apt-get install nodejs npm
ln -s /usr/bin/nodejs /usr/bin/node

# Make sure our npm setup is fresh, and use latest stable node/npm
npm cache clean -f
npm install -g n
n stable


# Neo4j from official repo:
#wget -O - http://debian.neo4j.org/neotechnology.gpg.key | apt-key add -
#echo 'deb http://debian.neo4j.org/repo stable/' > /etc/apt/sources.list.d/neo4j.list
#apt-get update
#apt-get install openjdk-8-jre neo4j

## Neo4j docker:
##apt-get install docker
#apt-key adv --keyserver hkp://pgp.mit.edu:80 --recv-keys 58118E89F3A912897C070ADBF76221572C52609D
#cat >/etc/apt/sources.list.d/docker.list <<-EOF
## Ubuntu Trusty or Mint 17.2
#deb https://apt.dockerproject.org/repo ubuntu-trusty main
#EOF
#apt-get update
#apt-get install docker-engine
#service docker start
## Remove old, possibly conflicting docker container and image
#docker stop neo4j
#docker rm neo4j
#docker rmi $(sudo docker images -q neo4j/neo4j)
## Get docker image for Neo4j, and set up the initial config file
#docker run \
#    --detach \
#    --name neo4j \
#    --env=NEO4J_AUTH=neo4j/Zna41016 \
#    --env=NEO4J_CACHE_MEMORY=2048M \
#    --env=NEO4J_HEAP_MEMORY=2048 \
#    --env=NEO4J_ALLOW_STORE_UPGRADE=true \
#    --volume $HOME/neo4j/data:/data \
#    --publish 8474:7474 \
#    neo4j/neo4j:2.3.1

echo Dependencies installed
echo Run setup script to complete install

