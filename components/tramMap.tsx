import { useEffect } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import StadiaMaps from "ol/source/StadiaMaps";
import OSM from "ol/source/OSM";
import * as OlProj from "ol/proj";
import { grayscaleLayer } from "../utils/mapUtils";
import RenderEvent from "ol/render/Event";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Style from "ol/style/Style.js";
import { Circle, Stroke, Fill } from "ol/style.js";
import "../utils/types";

export default function TramMap({
  lineData,
  stationData,
  tramData,
}: {
  lineData: Line[];
  stationData: Station[];
  tramData: Tram[];
}) {
  // FUNCTIONS TO PARSE THE DATA
  const getStationData = (data: Station[]) => {
    let geoJson = { type: "FeatureCollection", features: [] };
    for (let station of data) {
      let feature = {
        type: "Feature",
        geometry: { type: "Point", coordinates: station.coords },
        properties: {
          name: station.name,
        },
      };
      geoJson.features.push(feature);
    }
    return geoJson;
  };

  const getLineData = (data: Line[]) => {
    let geoJSON = { type: "FeatureCollection", features: [] };
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
    let geoJSON = { type: "FeatureCollection", features: [] };
    for (let tram of data) {
      let current_stop = tram.stops.find(
        (s) => s.stop_sequence == Math.floor(tram.progress)
      );
      let feature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: stationData.find((s) => s.diva == current_stop?.stop_diva)?.coords,
        },
        properties: {
          color: lineData.find((l) => l.name == tram.route_name)?.color,
        },
      };
      geoJSON.features.push(feature);
    }
    return geoJSON;
  };

  // GET THE GEOJSON
  const stationGeoJSON = getStationData(stationData);
  const lineGeoJSON = getLineData(lineData);
  const tramGeoJSON = getTramData(tramData);
  const view = new View({
    center: OlProj.fromLonLat([8.5417, 47.3769]),
    zoom: 15,
  });

  const stadia = new TileLayer({
    source: new StadiaMaps({
      layer: "alidade_smooth",
      retina: true,
    }),
  });

  const osm = new TileLayer({
    source: new OSM(),
  });
  osm.on("postrender", function (event: RenderEvent) {
    grayscaleLayer(event.context);
  });

  useEffect(() => {
    const stationLayer = new VectorLayer({
      source: new VectorSource({
        features: new GeoJSON().readFeatures(stationGeoJSON, {
          featureProjection: view.getProjection(),
        }),
      }),
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

    const lineLayer = new VectorLayer({
      source: new VectorSource({
        features: new GeoJSON().readFeatures(lineGeoJSON, {
          featureProjection: view.getProjection(),
        }),
      }),
      visible: true,
      style: (feature) =>
        new Style({
          stroke: new Stroke({
            width: 2,
            color: feature.get("color"),
          }),
        }),
    });

    const tramLayer = new VectorLayer({
      source: new VectorSource({
        features: new GeoJSON().readFeatures(tramGeoJSON, {
          featureProjection: view.getProjection(),
        }),
      }),
      visible: true,
      style: (feature) =>
        new Style({
          image: new Circle({
            radius: 5,
            fill: new Fill({
              color: feature.get("color"),
            }),
          }),
        }),
    });

    const map = new Map({
      target: "map",
      layers: [osm, stationLayer, lineLayer, tramLayer],
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

    return () => {
      map.setTarget(null);
    };
  }, [stationData, lineData, tramData]);

  return (
    <>
      <div id="map" style={{ width: "100%", height: "100%" }} />
    </>
  );
}
