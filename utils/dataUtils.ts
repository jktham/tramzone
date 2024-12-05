import { getTramLocation } from "./mapUtils";

export function getStationData (data: Station[]) {
    let geoJson = {type: "FeatureCollection", features: []};
    let additionalContent = { type: "station" };
    for (let station of data) {
        let feature = {
            type: "Feature",
            geometry: {type: "Point", coordinates: station.coords},
            properties: { ...station, ...additionalContent },
        };
        geoJson.features.push(feature);
    }
    return geoJson;
};

export function getLineData (data: Line[]) {
    let geoJSON = {type: "FeatureCollection", features: []};
    for (let line of data) {
        for (let segment of line.segments) {
            let additionalContent = { type: "line" };
            let feature = {
                type: "Feature",
                geometry: segment.geometry,
                properties: { ...line, ...additionalContent },
            };
            geoJSON.features.push(feature);
        }
    }
    return geoJSON;
};

export function getTramData (data: Tram[], lineData: Line[]) {
    let geoJSON = {type: "FeatureCollection", features: []};
    for (let tram of data) {
        let additionalContent = {type: "tram", color: lineData.find((l) => l.name == tram.route_name)?.color, name: tram.route_name}
        let feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: getTramLocation(tram, lineData),
            },
            properties: {...tram, ...additionalContent},
        };
        geoJSON.features.push(feature);
    }
    return geoJSON;
};