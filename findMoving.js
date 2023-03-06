#!/usr/bin/env node

const {program} = require('commander');
const fs = require('fs');
const path = require('path');


program
    .option('-d, --dir <directory>')

program.parse();

const options = program.opts();

let dirname = options.dir;
let filenames = fs.readdirSync(dirname);

let _ships = new Map();

for (let i in filenames) {
    let fileString = filenames[i];
    let filename = path.resolve(`./${dirname}/${fileString}`);
    let items = [];
    if (fs.existsSync(filename)) {
        let str = fs.readFileSync(filename).toString('utf-8');
        str.split(/\n/).forEach((line) => {
            let [MMSI, BaseDateTime, LAT, LONG, SOG, COG, Heading, VesselName, IMO, CallSign, VesselType, Status, Length, Width, Draft, Cargo, TransceiverClass] = line.split(/,/);
            if(Number(SOG) > 1) {

                console.log("Ship:", MMSI, "\tSOG:", SOG);
            }
        });
    } else {
        console.error("Could not find the filename:", filename);
        process.exit(0);
    }
}
