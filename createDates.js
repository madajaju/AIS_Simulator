#!/usr/bin/env node

const {program} = require('commander');
const fs = require('fs');
const path = require('path');


program
    .option('-s, --ships <directory>')
    .option('-d, --dates <directory>')

program.parse();

const options = program.opts();

let dirname = options.ships;
let filenames = fs.readdirSync(dirname);

let _dates = {};

for (let i in filenames) {
    let fileString = filenames[i];
    let filename = path.resolve(`./${dirname}/${fileString}`);
    let items = [];
    if (fs.existsSync(filename)) {
        let str = fs.readFileSync(filename).toString('utf-8');
        str.split(/\n/).forEach((line) => {
            let [MMSI, BaseDateTime, LAT, LONG, SOG, COG, Heading, VesselName, IMO, CallSign, VesselType, Status, Length, Width, Draft, Cargo, TransceiverClass] = line.split(/,/);
            let BaseDate = BaseDateTime;
                let latN = Math.round(LAT);
                let longN = Math.round(LONG);
                if(!_dates.hasOwnProperty(BaseDate)) {
                    console.log("New Group:", BaseDate);
                    _dates[BaseDate] = {};
                }
                if(!_dates[BaseDate].hasOwnProperty(MMSI)) {
                    _dates[BaseDate][MMSI] = 0;
                }
                _dates[key][MMSI]++;
        });
    } else {
        console.error("Could not find the filename:", filename);
        process.exit(0);
    }
}
let items = [];
for(let i in _locations) {
   items.push( {id:i, length: Object.keys(_locations[i]).length, ships: _locations[i]});
}
let isort = items.sort((a,b) => b.length - a.length);
console.log(isort);
