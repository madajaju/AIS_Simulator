#!/usr/bin/env node

const {program} = require('commander');
const fs = require('fs');
const es = require('event-stream');
const path = require('path');


program
    .option('-d, --dates <directory>')
    .option('-u, --usv <directory>')

program.parse();

const options = program.opts();

let usvDir = options.usv;

let usvs = fs.readdirSync(usvDir);

let _stats = {};
let _ships = new Map();
_ships.date = '';
_ships.time = new Map();

_hits = {};

const TIME_WINDOW = 7 * 60 * 1000; // 20 minutes
const HOUR_WINDOW = 24; // 6 hours
const degreeToMeter = 1 / 111139; // Meters
const DIST_WINDOW = 100; // 100 Meters
const _processUSV = (usvs) => {
    let uname = usvs.pop();
    let startTime = new Date();
    if (uname) {
        let hitsFile = path.resolve(`${usvDir}/${uname}/hits.csv`);
        let count = 0;
        const usvStream = fs.createReadStream(hitsFile)
            .pipe(es.split())
            .pipe(es.mapSync((line) => {
                    let [MMSI, BaseDateTime, LAT, LONG, SOG, COG, Heading, VesselType, Length, Width] = line.split(/,/);
                    // Normalize the LAT and LONG to within 25M.
                    if (BaseDateTime) {
                        let baseTime = new Date(BaseDateTime);
                        let LATKey = Math.floor((LAT / degreeToMeter) / DIST_WINDOW);
                        let LONGKey = Math.floor((LONG / degreeToMeter) / DIST_WINDOW);
                        let locKey = `${LATKey}_${LONGKey}`;
                        let timeKey = Math.floor(baseTime / (TIME_WINDOW / 2));
                        if (!_hits.hasOwnProperty(locKey)) {
                            _hits[locKey] = {};
                        }
                        if (!_hits[locKey].hasOwnProperty(timeKey)) {
                            _hits[locKey][timeKey] = [];
                        }

                        _hits[locKey][timeKey].push({
                            MMSI: MMSI,
                            BaseDateTime: BaseDateTime,
                            LAT: LAT,
                            LONG: LONG,
                            SOG: SOG,
                            COG: COG,
                            Heading: Heading,
                            VesselType: VesselType,
                            Length: Length,
                            Width: Width
                        });
                    }
                })
                    .on('end', () => {
                        _checkAgainstAIS();
                        console.log("Elapsed Time:", (startTime - new Date()) / 1000);
                        _processUSV(usvs);
                    })
            );
    } else {
        console.log("Done");
    }
}

const _checkAgainstAIS = () => {
    for (let locKey in _hits) {
        let location = _hits[locKey];
        for (let timeKey in location) {
            let period = location[timeKey];
            // There is more than one ship in the same location for the period of time.
            // Check the AIS data if there are two ships.
            if (period.length > 1) {
                let BaseDateTime = period[0].BaseDateTime
                let [day, time] = BaseDateTime.split('T');
                let [hour, minute] = time.split(':');
                // Open the date file and then find the BaseDateTime within 6 minutes.
                _loadDateFile(options.dates, day, hour);
                // Now Check
                // calculate time window
                let offset = -1;
                while (offset <= 1) {
                    offset++;
                    let key = Number(timeKey) + offset;
                    if (_ships.time[key]) {
                        ships = _ships.time[key];
                        numberFound = 0;
                        // Now iterate through the ships and compare the LAT and LONG with the Window.
                        for(let j in ships) {
                            let ship = ships[j];
                            let LATKey = Math.floor((ship.LAT / degreeToMeter) / DIST_WINDOW);
                            let LONGKey = Math.floor((ship.LONG / degreeToMeter) / DIST_WINDOW);
                            let aisLocKey = `${LATKey}_${LONGKey}`;
                            if(locKey === aisLocKey) {
                                console.log("HIT:", key, aisLocKey);
                                numberFound++;
                            }
                        }
                        if (numberFound !== period.length) {
                            if (!_stats.hasOwnProperty(locKey)) {
                                _stats[locKey] = {};
                            }
                            _stats[locKey][timeKey] = {
                                ais: numberFound,
                                usv: period.length
                            };
                        }
                    }
                }
            }
        }
    }
}
const _loadDateFile = (dir, day, hour) => {
    if (_ships.date !== `${day}.${Math.floor(hour / HOUR_WINDOW)}`) {
        let currentDate = new Date();
        console.log("Loading day file:", day, hour);
        _ships.time = null;
        _ships.date = `${day}.${Math.floor(hour / HOUR_WINDOW)}`;
        _ships.time = new Map();
        const dayAISFile = path.resolve(`${dir}/AIS_${day.replaceAll('-', '_')}.csv`);
        if (!fs.existsSync(dayAISFile)) {
            return;
        }
        const fd = fs.openSync(dayAISFile);
        const bufferSize = 64 * 1024;
        let buffer = new Buffer(bufferSize);
        let leftOver = '';
        let lineCount = 0;
        let read;
        let lines;

        while ((read = fs.readSync(fd, buffer, 0, bufferSize, null)) !== 0) {
            lines = buffer.toString('utf-8', 0, read).split('\n');
            lines[0] = leftOver + lines[0];
            while (lines.length > 1) {
                _parseLine(lines.shift(), Math.floor(hour / HOUR_WINDOW));
                lineCount++;
            }
            leftOver = lines.shift();
        }
        if (leftOver) {
            _parseLine(leftOver, Math.floor(hour / HOUR_WINDOW));
        }
        console.log("Time to Get file:", currentDate - new Date());
    }
}
const _parseLine = (pLine, pHour) => {
    let [MMSI, BaseDateTime, LAT, LONG, SOG, COG, Heading, VesselName, IMO, CallSign, VesselType, Status, Length, Width, Draft, Cargo, TransceiverClass] = pLine.split(/,/);
    let [day, time] = BaseDateTime.split('T');
    let [hour, minute] = time.split(':');
    if (Math.floor(hour / HOUR_WINDOW) === pHour) {
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
        let baseTime = new Date(BaseDateTime);
        let key = Math.floor(baseTime / (TIME_WINDOW / 2));
        if (!_ships.time.hasOwnProperty(key)) {
            _ships.time[key] = [];
        }
        _ships.time[key].push(jsonline);
    }
}


_processUSV(usvs);
