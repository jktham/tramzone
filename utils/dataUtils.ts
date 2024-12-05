import { getTramLocation } from "./mapUtils";

export function getStationData (data: Station[]) {
    let geoJson = {type: "FeatureCollection", features: []};
    for (let station of data) {
        let feature = {
            type: "Feature",
            geometry: {type: "Point", coordinates: station.coords},
            properties: station,
        };
        geoJson.features.push(feature);
    }
    return geoJson;
};

export function getLineData (data: Line[]) {
    let geoJSON = {type: "FeatureCollection", features: []};
    for (let line of data) {
        for (let segment of line.segments) {
            let feature = {
                type: "Feature",
                geometry: segment.geometry,
                properties: line,
            };
            geoJSON.features.push(feature);
        }
    }
    return geoJSON;
};

export function getTramData (data: Tram[], lineData: Line[]) {
    let geoJSON = {type: "FeatureCollection", features: []};
    for (let tram of data) {
        let additionalInfo = { color: lineData.find((l) => l.name == tram.route_name)?.color }
        let feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: getTramLocation(tram, lineData),
            },
            properties: {...tram, ...additionalInfo},
        };
        geoJSON.features.push(feature);
    }
    return geoJSON;
};