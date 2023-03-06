#!/usr/bin/env node

const {program} = require('commander');
const fs = require('fs');
const es = require('event-stream');
const path = require('path');

program
    .option('-f, --file <filename>')
    .option('-d, --dir <dir>');

program.parse();

const options = program.opts();

let dirName = options.dir;

if(!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName);
}

let filename = path.resolve(`./${options.file}`);
if (fs.existsSync(filename)) {
    let totalLines = 0;
    const ships = {};
    let currentShip = "";
    let buffer = "";
    const s = fs.createReadStream(filename)
        .pipe(es.split())
        .pipe(
            es
                .mapSync(function(line) {
                    totalLines++;
                    const items = line.split(/,/);
                    if (!ships[items[0]]) {
                        ships[items[0]] = 0;
                    }
                    if(items[0] != currentShip) {
                        fs.appendFile(`${dirName}/${currentShip}.csv`, buffer, (err) => {
                            if(err) { console.error("File Error:", err)} ;
                        });
                        buffer = line + '\n';
                        currentShip = items[0];
                    } else {
                        buffer += line + '\n';
                    }
                    ships[items[0]]++;
                })
                .on('error', function(err) {
                    console.error("Error while reading file.", err);
                })
                .on('end', function() {
                    console.log("Lines:", totalLines);
                    console.log("Ships:", Object.keys(ships).length);
                })
        );
} else {
    console.error("Could not find the filename:", filename);
}
