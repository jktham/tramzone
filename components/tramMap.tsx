import {useEffect, useState} from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import StadiaMaps from "ol/source/StadiaMaps";
import OSM from "ol/source/OSM";
import * as OlProj from "ol/proj";
import {getTramLocation, grayscaleLayer} from "../utils/mapUtils";
import RenderEvent from "ol/render/Event";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Style from "ol/style/Style.js";
import {Circle, Stroke, Fill} from "ol/style.js";
import "../utils/types";
import {Layer} from "ol/layer";

export default function TramMap({lineData, stationData, tramData}: { lineData: Line[]; stationData: Station[]; tramData: Tram[]; }) {

  // FUNCTIONS TO PARSE THE DATA TODO: put in different file ////
  const getStationData = (data: Station[]) => {
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

  const getLineData = (data: Line[]) => {
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

  const getTramData = (data: Tram[]) => {
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
  // TODO: up until here ////

  const [map, setMap] = useState<Map>(null);

  // GET THE GEOJSON
  const stationGeoJSON = getStationData(stationData);
  const lineGeoJSON = getLineData(lineData);
  const tramGeoJSON = getTramData(tramData);
  const view = new View({
    center: OlProj.fromLonLat([8.5417, 47.3769]),
    zoom: 15,
  });

  const stadiaLayer = new TileLayer({
    source: new StadiaMaps({
      layer: "alidade_smooth",
      retina: true,
    }),
  });

  const osmLayer = new TileLayer({
    source: new OSM(),
  });

  const lineLayer = new VectorLayer({
    visible: true,
    style: (feature) =>
        new Style({
          stroke: new Stroke({
            width: 2,
            color: feature.get("color"),
          }),
        }),
  });

  const stationLayer = new VectorLayer({
    visible: true,
    style: new Style({
      image: new Circle({
        radius: 5,
        fill: new Fill({
          color: "#000000",
        }),
      }),
    }),
  });

  const tramLayer = new VectorLayer({
    visible: true,
    style: (feature) =>
        new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({
              color: feature.get("color"),
            }),
          }),
        }),
  });

  useEffect(() => {
    const map = new Map({
      target: "map",
      layers: [osmLayer, lineLayer, stationLayer, tramLayer],
    });

    map.setView(
        new View({
          center: OlProj.fromLonLat([8.5417, 47.3769]),
          zoom: 15,
        })
    );

    map.on("click", function (e) {
      map.forEachFeatureAtPixel(e.pixel, function (feature, layer) {
        console.log(feature);
      });
    });

    setMap(map)

    return () => {
      map.setTarget(null);
      setMap(null);
    };
  }, []);

  useEffect(() => {

    lineLayer.setSource(new VectorSource({
      features: new GeoJSON().readFeatures(lineGeoJSON, {
        featureProjection: view.getProjection(),
      }),
    }))

    stationLayer.setSource(new VectorSource({
      features: new GeoJSON().readFeatures(stationGeoJSON, {
        featureProjection: view.getProjection(),
      }),
    }))

    tramLayer.setSource( new VectorSource({
      features: new GeoJSON().readFeatures(tramGeoJSON, {
        featureProjection: view.getProjection(),
      }),
    }))

  }, []);

  useEffect(() => {

    // no idea if this works, couldn't test yet cuz after midnight all trams were suddenly gone
    tramLayer.getSource().removeFeatures(tramLayer.getSource().getFeatures())
	tramLayer.getSource().addFeatures(new GeoJSON().readFeatures(tramGeoJSON, {
		featureProjection: view.getProjection(),
	}))
    tramLayer.getSource()?.dispatchEvent("change")

  }, [tramData]);

  return (
      <>
        <div id="map" style={{width: "100%", height: "100%"}}/>
      </>
  );
}
