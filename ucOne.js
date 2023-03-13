#!/usr/bin/env node

const {program} = require('commander');
const fs = require('fs');
const path = require('path');
const noContactTrigger = 20 * 60 * 1000;

program
    .option('-f, --files <filenames>')
    .option('-s, --ships <directory>')

program.parse();

const options = program.opts();
let _stats = {};
let filenames = [];
if(options.ships) {
	filenames = fs.readdirSync(options.ships).map((filename) => { return `${options.ships}/${filename}` });
} else {
	filenames = options.files.split(/,/);
}

let _ships = new Map();

for (let i in filenames) {
    let fileString = filenames[i];
    let filename = path.resolve(`./${fileString}`);
    let items = [];
    console.log("Checking Ship:", filename);
    if (fs.existsSync(filename)) {
        let str = fs.readFileSync(filename).toString('utf-8');
        str.split(/\n/).forEach((line) => {
            let [MMSI, BaseDateTime, LAT, LONG, SOG, COG, Heading, VesselName, IMO, CallSign, VesselType, Status, Length, Width, Draft, Cargo, TransceiverClass] = line.split(/,/);
            let jsonline = {
                MMSI: MMSI,
                BaseDateTime: new Date(BaseDateTime),
                LAT: LAT,
                LONG: LONG,
                SOG: SOG,
                COG: COG,
                Heading: Heading,
                VesselName: VesselName,
                IMO: IMO,
                CallSign: CallSign,
                VesselType: VesselType,
                Status: Status,
                Length: Length,
                Width: Width,
                Draft: Draft,
                Cargo: Cargo,
                TransceiverClass: TransceiverClass
            }
            items.push(jsonline);
        });
        let sortedTransmit = items.sort((a, b) => {
            return b.BaseDateTime - a.BaseDateTime;
        });
        let current = sortedTransmit.pop();
        transmit(sortedTransmit, current);
    } else {
        console.error("Could not find the filename:", filename);
    }
}
console.log("Stats:", _stats);

function transmit(sortedTransmit, current) {
    while(sortedTransmit.length > 0) {
        const next = sortedTransmit.pop();
        const difference = current.BaseDateTime - next.BaseDateTime;
        if(!isNaN(difference)) {
            if (Math.abs(difference) > noContactTrigger) {
		if(!_stats.hasOwnProperty(current.MMSI)) {
			_stats[current.MMSI]= 0;
		}
                _stats[current.MMSI]++;
            }
        }
        current = next;
    }
}

