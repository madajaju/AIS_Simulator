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
let _usv = {};
let _ships = new Map();

const TIME_WINDOW = 7 * 60 * 1000; // 20 minutes
const HOUR_WINDOW = 24; // 6 hours

const _processUSV = (usvs) => {
    let startTime = new Date();
    for (let fi in usvs) {
        let uname = usvs[fi];
        let hitsFile = path.resolve(`${usvDir}/${uname}/hits.csv`);
        console.log("Analyzing USV:", uname);
        _loadUSVFile(hitsFile);
        console.log("USV found: ", Object.keys(_usv).length, "times");
        let count = 0;
        let timeKeys = Object.keys(_usv).sort();
        for (let ti in timeKeys) {
            count++;
            let timeKey = Number(timeKeys[ti]);
            let uShips = _usv[timeKey];
            console.log("Searching for Time:", count, timeKey);
            let baseTime = new Date(timeKey * (TIME_WINDOW / 2));
            let [day] = baseTime.toISOString().split('T');
            let hour = baseTime.getHours();
            let dateKey = `${day}.${Math.floor(hour / HOUR_WINDOW)}`;
            _loadDateFile(options.dates, day, hour);
            for (let MMSI in uShips) {
                let uShip = uShips[MMSI];
                let ships = _ships[dateKey].time[timeKey];
                if (ships && ships.hasOwnProperty(MMSI)) {
                    let ship = ships[MMSI][0];
                    if (ship.VesselType !== uShip.VesselType) {
                        if (!_stats.hasOwnProperty(MMSI)) {
                            _stats[MMSI] = 0;
                        }
                        _stats[MMSI]++;
                    }
                }
            }
        }
        console.log("Elapsed Time:", (startTime - new Date()) / 1000);
        // console.log(_stats);
    }
}

const _loadUSVFile = (filename) => {
    _usv = {};
    _loadLines(filename, _parseUSVLine, {});
}
const _parseUSVLine = (line) => {
    let [MMSI, BaseDateTime, LAT, LONG, SOG, COG, Heading, VesselType, Length, Width] = line.split(/,/);
    let baseTime = new Date(BaseDateTime);
    let timeKey = Math.floor(baseTime / (TIME_WINDOW / 2));
    if (!_usv.hasOwnProperty(timeKey)) {
        _usv[timeKey] = {};
    }
    if (!_usv[timeKey].hasOwnProperty(MMSI)) {
        _usv[timeKey][MMSI] = [];
    }
    _usv[timeKey][MMSI].push({BaseDateTime: baseTime, LAT: Number(LAT), LONG: Number(LONG), VesselType: VesselType});
}
const _loadLines = (filename, fn, params) => {
    const bufferSize = 64 * 1024;
    let buffer = new Buffer(bufferSize);
    let leftOver = '';
    let lineCount = 0;
    let read;
    let lines;
    const fd = fs.openSync(filename);
    while ((read = fs.readSync(fd, buffer, 0, bufferSize, null)) !== 0) {
        lines = buffer.toString('utf-8', 0, read).split('\n');
        lines[0] = leftOver + lines[0];
        while (lines.length > 1) {
            fn(lines.shift(), params);
            lineCount++;
        }
        leftOver = lines.shift();
    }
    if (leftOver) {
        fn(leftOver, params);
    }
}

const _loadDateFile = (dir, day, hour) => {
    let dateKey = `${day}.${Math.floor(hour / HOUR_WINDOW)}`;
    if (!_ships.hasOwnProperty(dateKey)) {
        _ships = null;
        _ships = {};
        _ships[dateKey] = {time: new Map()};
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
            _parseLine(leftOver, Math.floor(hour / HOUR_WINDOW), dateKey);
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
            LAT: Number(LAT),
            LONG: Number(LONG),
            SOG: SOG,
            COG: COG,
            // Heading: Heading,
            // VesselName: VesselName,
            // IMO: IMO,
            // CallSign: CallSign,
            VesselType: VesselType,
            // Status: Status,
            Length: Length,
            Width: Width,
            // Draft: Draft,
            // Cargo: Cargo,
            // TransceiverClass: TransceiverClass
        }
        let baseTime = new Date(BaseDateTime);
        let key = Math.floor(baseTime / (TIME_WINDOW / 2));
        if (!_ships[dateKey].time.hasOwnProperty(key)) {
            _ships[dateKey].time[key] = {};
        }
        if (!_ships[dateKey].time[key].hasOwnProperty(MMSI)) {
            _ships[dateKey].time[key][MMSI] = [];
        }
        _ships[dateKey].time[key][MMSI].push(jsonline);
    }
}

_processUSV(usvs);
