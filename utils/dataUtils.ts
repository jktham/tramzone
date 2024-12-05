import { getTramLocation } from "./mapUtils";

export function getStationData (data: Station[]) {
    let geoJson = {type: "FeatureCollection", features: []};
    for (let station of data) {
        let feature = {
            type: "Feature",
            geometry: {type: "Point", coordinates: station.coords},
            properties: {
                name: station.name,
            },
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
                properties: {
                    name: line.name,
                    color: line.color,
                },
            };
            geoJSON.features.push(feature);
        }
    }
    return geoJSON;
};

export function getTramData (data: Tram[], lineData: Line[]) {
    let geoJSON = {type: "FeatureCollection", features: []};
    for (let tram of data) {
        let feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: getTramLocation(tram, lineData),
            },
            properties: {
                name: tram.route_name,
                color: lineData.find((l) => l.name == tram.route_name)?.color,
            },
        };
        geoJSON.features.push(feature);
    }
    return geoJSON;
};