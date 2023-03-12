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

const TIME_WINDOW = 7 * 60 * 1000; // 20 minutes
const HOUR_WINDOW = 12; // 6 hours

const _processUSV = (usvs) => {
    let uname = usvs.pop();
    console.log("Analyzing USV:", uname);
    let startTime = new Date();
    if (uname) {
        let hitsFile = path.resolve(`${usvDir}/${uname}/hits.csv`);
        const usvStream = fs.createReadStream(hitsFile)
            .pipe(es.split())
            .pipe(es.mapSync((line) => {
                    let [MMSI, BaseDateTime, LAT, LONG, SOG, COG, Heading, VesselType, Length, Width] = line.split(/,/);
                    if (BaseDateTime) {
                        let [day, time] = BaseDateTime.split('T');
                        let [hour, minute] = time.split(':');
                        // Open the date file and then find the BaseDateTime within 6 minutes.
                        _loadDateFile(options.dates, day, hour);
			let dateKey = `${day}.${Math.floor(hour / HOUR_WINDOW)}`;
                        // Now Check
                        // calculate time window
                        let baseTime = new Date(BaseDateTime);
                        let timeKey = Math.floor(baseTime / (TIME_WINDOW / 2));
                        for (let offset = -1; offset <= 1; offset++) {
                            let key = timeKey + offset;
                            if (_ships[dateKey].time[key]) {
                                let ships = _ships[dateKey].time[key];
				if(ships.hasOwnProperty(MMSI)) {
					for(let i in ships[MMSI]) {
						let point = ships[MMSI][i];
						// Check that the tracks are the same.
						if (LAT !== point.LAT || LONG !== point.LONG) {
						    if (!_stats.hasOwnProperty(MMSI)) {
							_stats[MMSI] = 0;
						    }
						    _stats[MMSI]++;
						}
					}
                                 }
			     }
                        }
                    }
                })
                .on('end', () => {
                    console.log("Elapsed Time:", (startTime - new Date())/1000 );
                    console.log(_stats);
                    _processUSV(usvs);
                })
            );
    } else {
        console.log("Done");
    }
}

const _loadDateFile = (dir, day, hour) => {
	let dateKey = `${day}.${Math.floor(hour / HOUR_WINDOW)}`;
    if (!_ships.hasOwnProperty(dateKey)) {
	_ships = null;
	_ships = {};
	_ships[dateKey] = { time: new Map() };
        const dayAISFile = path.resolve(`${dir}/AIS_${day.replaceAll('-', '_')}.csv`);
	console.log("Loading file:", dayAISFile);
	console.log(process.memoryUsage());
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
                _parseLine(lines.shift(), Math.floor(hour / HOUR_WINDOW), dateKey);
                lineCount++;
            }
            leftOver = lines.shift();
        }
        if (leftOver) {
            _parseLine(leftOver, Math.floor(hour / HOUR_WINDOW),dateKey);
        }
	console.log("Done Loading:", process.memoryUsage());
    }
}
const _parseLine = (pLine, pHour, dateKey) => {
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
        if (!_ships[dateKey].time.hasOwnProperty(key)) {
            _ships[dateKey].time[key] = {};
        }
	if(!_ships[dateKey].time[key].hasOwnProperty(MMSI)) {
		_ships[dateKey].time[key][MMSI] = [];
	}
        _ships[dateKey].time[key][MMSI].push(jsonline);
    }
}


_processUSV(usvs);
