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
let _locations = new Map();

for (let i in filenames) {
    let fileString = filenames[i];
    let filename = path.resolve(`./${dirname}/${fileString}`);
    let items = [];
    if (fs.existsSync(filename)) {
        let str = fs.readFileSync(filename).toString('utf-8');
        str.split(/\n/).forEach((line) => {
            let [MMSI, BaseDateTime, LAT, LONG, SOG, COG, Heading, VesselName, IMO, CallSign, VesselType, Status, Length, Width, Draft, Cargo, TransceiverClass] = line.split(/,/);
            if(Number(SOG) > 1) {
                let latN = Math.round(LAT);
                let longN = Math.round(LONG);
                let key = `${latN}_${longN}`;
                if(!_locations.hasOwnProperty(key)) {
                    console.log("New Group:", key);
                    _locations[key] = {};
                }
                if(!_locations[key].hasOwnProperty(MMSI)) {
                    _locations[key][MMSI] = 0;
                }
                _locations[key][MMSI]++;
            }
        });
    } else {
        console.error("Could not find the filename:", filename);
        process.exit(0);
    }
}
console.log(_locations);
