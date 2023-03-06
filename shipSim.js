#!/usr/bin/env node

const {program} = require('commander');
const fs = require('fs');
const path = require('path');


program
    .option('-f, --files <filenames>')

program.parse();

const options = program.opts();

let filenames = options.files.split(/,/);

let _ships = new Map();

for (let i in filenames) {
    let fileString = filenames[i];
    let filename = path.resolve(`./${fileString}`);
    let items = [];
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
        process.exit(0);
    }
}

function transmit(sortedTransmit, current) {
    if (sortedTransmit.length > 0) {
        const next = sortedTransmit.pop();
        const difference = current.BaseDateTime - next.BaseDateTime;
        const timedelay = Math.abs(difference) / 1000 || 1;
        timeCompress(current);
        setTimeout(transmit, timedelay, sortedTransmit, next);
    } else {
        return 0;
    }
}


function timeCompress(aisItem) {
    if (!_ships) {
        _ships = {};
    }
    console.log("SHIPS:", Object.keys(_ships).length);
    if (!_ships.hasOwnProperty(aisItem.MMSI)) {
        _ships[aisItem.MMSI] = {
            MMSI: aisItem.MMSI,
            VesselName: aisItem.VesselName,
            IMO: aisItem.IMO,
            CallSign: aisItem.CallSign,
            VesselType: aisItem.VesselType,
            Length: aisItem.Length,
            Width: aisItem.Width,
            Draft: aisItem.Draft,
            Cargo: aisItem.Cargo,
            TransceiverClass: aisItem.TransceiverClass,
            location: [{
                BaseDateTime: aisItem.BaseDateTime,
                LAT: aisItem.LAT,
                LONG: aisItem.LONG,
                SOG: aisItem.SOG,
                COG: aisItem.COG,
                Heading: aisItem.Heading,
                Status: aisItem.Status,
            }]
        };
    } else {
        let locations = _ships[aisItem.MMSI].location;
        let lastLocation = locations.slice(-1)[0];
        if (lastLocation.LAT !== aisItem.LAT || lastLocation.LONG !== aisItem.LONG) {
            locations.push({
                BaseDateTime: aisItem.BaseDateTime,
                LAT: aisItem.LAT,
                LONG: aisItem.LONG,
                SOG: aisItem.SOG,
                COG: aisItem.COG,
                Heading: aisItem.Heading,
                Status: aisItem.Status,
            });
            detectCollision(_ships[aisItem.MMSI], locations.slice(-1)[0]);
            estimateDivergence(_ships[aisItem.MMSI], locations.slice(-1)[0]);
        }
    }
}


// Check each ship based on the last location and the previous location
// Check the size width and legnth of the ship compared to the COGS and the location
// Check each ship against each other. Sorting the list should make the algorithm faster.

// This should be a sorted list.
// Sort this by LAT and the Longitude
let _shipsLoc = {};

function detectCollision(ship, location) {

    if (_shipsLoc.hasOwnProperty(ship.MMSI)) {
        // update the ship location
        _shipsLoc[ship.MMSI].locations.push(location);
    } else {
        _shipsLoc[ship.MMSI] = ship;
        _shipsLoc[ship.MMSI].locations = [location];
    }
    // Compare each ship with every other ship.
    const LATInMeters = 111139;
    const LONGInMeters = 111139;
    const MeterPerSecond = 0.5411 * 60 * 3;
    const closeMiss = 100 / LATInMeters;
    // Estimated next location in 3 minutes
    for (let i in _shipsLoc) {
        let shipi = _shipsLoc[i];
        locationi = _shipsLoc[i].location.slice(-1);
        for (let j in _shipsLoc) {
            let shipj = _shipsLoc[j];
            // COG is the direction 0 is LAT
            if(Math.abs(shipj.locations.slice(-1).LAT - locationi.LAT) < closeMiss) {
                if(Math.abs(shipj.locations.slice(-1).LONG - locationi.LONG) < closeMiss) {
                    console.error("Near Miss Warning:", shipi.MMSI, shipj.MMSI);
                }
            }
        }
    }
}


// Estimate the next position from the current course and speed.
// Check the distance from the projected course and the actual course with the next ping from the ship.

let _shipsEstimate = {};

function estimateDivergence(ship, location) {

    const LATInMeters = 111139;
    const LONGInMeters = 111139;
    const MeterPerSecond = 0.5411;

    if (_shipsEstimate.hasOwnProperty(ship.MMSI)) {
        // update the ship location
        _shipsEstimate[ship.MMSI].locations.push(location);
    } else {
        _shipsEstimate[ship.MMSI] = ship;
        _shipsEstimate[ship.MMSI].locations = [location];
    }
    if(_shipsEstimate[ship.MMSI].hasOwnProperty('estimateLocations')) {
        let LATDivergence = location.LAT - _shipsEstimate[ship.MMSI].estimateLocations[0].LAT;
        let LONGDivergence = location.LONG - _shipsEstimate[ship.MMSI].estimateLocations[0].LONG;
        let timeDifference = location.BaseDateTime - _shipsEstimate[ship.MMSI].estimateLocations[0].Time;
        console.log(LATDivergence*LATInMeters, LONGDivergence*LONGInMeters, timeDifference);
    }
    // Compare each ship with every other ship.
    const COGR = Number(location.COG) * (Math.PI/180);
    let nextLAT = Number(location.LAT);
    let nextLONG = Number(location.LONG);
    let nextTime = location.BaseDateTime;
    _shipsEstimate[ship.MMSI].estimateLocations = [];
    for(let i=0; i < 5; i++) {
        nextLAT = Number(location.LAT) + (Number(location.SOG)*MeterPerSecond*Math.cos(COGR)*60)/LATInMeters;
        nextLONG = Number(location.LONG) + (Number(location.SOG)*MeterPerSecond*Math.sin(COGR)*60)/LONGInMeters;
        nextTime = new Date(nextTime.getTime() + 60000);
        _shipsEstimate[ship.MMSI].estimateLocations.push({ LAT: nextLAT, LONG: nextLONG, Time: nextTime});
    }
}
