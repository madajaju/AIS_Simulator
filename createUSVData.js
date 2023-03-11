#!/usr/bin/env node

const {program} = require('commander');
const fs = require('fs');
const path = require('path');


program
    .option('-s, --source <directory>')
    .option('-a --area <LAT_LONG>')
    .option('-d, --destination <directory>')

program.parse();

const options = program.opts();

let dirname = options.source;
let filenames = fs.readdirSync(dirname);

let _ships = {};

for (let i in filenames) {
    let fileString = filenames[i];
    let filename = path.resolve(`./${dirname}/${fileString}`);
    let enterFlag = false;
    if (fs.existsSync(filename)) {
        let str = fs.readFileSync(filename).toString('utf-8');
        let points = [];
        str.split(/\n/).forEach((line) => {
            let [MMSI, BaseDateTime, LAT, LONG, SOG, COG, Heading, VesselName, IMO, CallSign, VesselType, Status, Length, Width, Draft, Cargo, TransceiverClass] = line.split(/,/);
            points.push({
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
            let latN = Math.round(LAT);
            let longN = Math.round(LONG);
            let key = `${latN}_${longN}`;
            if (key === options.area) {
                enterFlag = true;
            }
        });
        if (enterFlag) {
            _ships[filename] = points;
        }
    } else {
        console.error("Could not find the filename:", filename);
        process.exit(0);
    }
}

// Add a rouge ship every 25 ships with some changes in LAT and LONG
// Add another ship every 50 that changes the vessel type.
// Also create another ship that mirror another ship just off set with no MMSI every 35
// Ignore a ship every 43 to show a phantom ship.
let counter = 0;
let _points = {};
for (let i in _ships) {
    let ship = _ships[i];
    counter++;
    for (let j in ship) {
        let point = ship[j];
        let mtime = point.BaseDateTime;
        if (mtime) {

            if (!_points.hasOwnProperty(mtime)) {
                _points[mtime] = [];
            }
            // Ignore every 43rd ship
            if(counter % 43 > 0) {
                _points[mtime].push(point);
            }
            // Create another ship that mirrors
            if (counter % 25) {
                point.LAT = Number(point.LAT) + 0.01 * Math.random();
                point.LONG = Number(point.LONG) + 0.01 * Math.random();
                _points[mtime].push(point)
            } else if (counter % 50) { // Change vessel type every 50th ship
                point.VesselType = 31;
                _points[mtime].push(point);
            } else if (counter % 35) {
                point.LAT = Number(point.LAT) + 0.01 * Math.random();
                point.LONG = Number(point.LONG) + 0.01 * Math.random();
                point.MMSI = "0"
                _points[mtime].push(point)
            }
        }
    }
}

// Now create the USV hitsData
let usv = {
    MMSI: `9999` + options.area.replace(/_/, '').replace(/-/, ''),
    VesselName: "Simulator" + options.area,
    IMO: "IMO888" + options.area.replace(/_/, '').replace(/-/, ''),
    CallSign: "USV" + options.area
}
let destDir = options.destination

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
}
if (!fs.existsSync(`${destDir}/${options.area}`)) {
    fs.mkdirSync(`${destDir}/${options.area}`);
}

let hitsFile = path.resolve(`${destDir}/${options.area}/hits.csv`);
let aisFile = path.resolve(`${destDir}/${options.area}/ais.csv`);
let hitsStream = fs.createWriteStream(hitsFile, {flags: 'w'});
let aisStream = fs.createWriteStream(aisFile, {flags: 'w'});
for (let mtime in _points) {
    let points = _points[mtime];
    let centerPoint = {
        number: 0,
        LAT: 0,
        LONG: 0,
    };
    for (let i in points) {
        let point = points[i];
        let LAT = Number(point.LAT);
        let LONG = Number(point.LONG);
        if (!isNaN(LAT) && !isNaN(LONG)) {
            let line = `${point.MMSI},${point.BaseDateTime},${point.LAT},${point.LONG},${point.SOG},${point.COG},${point.Heading},${point.VesselType},${point.length},${point.Width}\n`;
            hitsStream.write(line);

            centerPoint.number++;
            centerPoint.LAT += LAT;
            centerPoint.LONG += LONG;
        }
    }
    centerPoint.LAT = centerPoint.LAT / centerPoint.number;
    centerPoint.LONG = centerPoint.LONG / centerPoint.number;

    aisStream.write(`${usv.MMSI},${mtime},${centerPoint.LAT},${centerPoint.LONG},10,180,170,${usv.VesselName},${usv.IMO},${usv.CallSign},35,8,5,3,1,,A\n`);
}

hitsStream.close();
aisStream.close();
