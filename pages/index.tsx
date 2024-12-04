import React, { useEffect, useState } from "react";
import "ol/ol.css";
import Map from "ol/Map.js";
import View from "ol/View.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import StadiaMaps from "ol/source/StadiaMaps.js";
import OSM from "ol/source/OSM.js";
import * as OlProj from "ol/proj";
import useSWR from "swr";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Style from "ol/style/Style.js";
import { Circle, Stroke, Fill } from "ol/style.js";
import { features } from "process";
import { convertLV95toWGS84 } from "../utils/mapUtils";
import TramMap from "../components/tramMap";

export default function Home() {
  const { data, isLoading } = useSWR("api/stations", (url) =>
    fetch(url).then((res) => res.json())
  );

  const getSationData = (data) => {
    let geoJson = { type: "FeatureCollection", features: [] };
    for (let point of data) {
      let coordinates = convertLV95toWGS84(point.coords);
      let properties = point.name;
      let feature = {
        type: "Feature",
        geometry: { type: "Point", coordinates: coordinates },
        properties: properties,
      };
      geoJson.features.push(feature);
    }
    return geoJson;
  };

  let geoJSON = { type: "FeatureCollection", features: [] };
  console.log(geoJSON);
  if (!isLoading) {
    console.log(data, isLoading);
    geoJSON = getSationData(data);
  }

  // Style for the Stations Layer
  const fill = new Fill({
    color: "rgba(0,0,0,1)",
  });

  const stroke = new Stroke({
    color: "#3399CC",
    width: 0,
  });

  useEffect(() => {
    let olView = new View({
      center: OlProj.fromLonLat([8.5417, 47.3769]),
      zoom: 15,
    });

    console.log(geoJSON);
    const features = new GeoJSON().readFeatures(geoJSON, {
      featureProjection: olView.getProjection(),
    });

    const stationLayer = new VectorLayer({
      source: new VectorSource({
        features: features,
      }),
      visible: true,
      style: new Style({
        image: new Circle({
          fill: fill,
          //stroke: stroke,
          radius: 5,
        }),
        fill: fill,
        //stroke: stroke,
      }),
    });

    const map = new Map({
      target: "map",
      layers: [
        new TileLayer({
          source: new StadiaMaps({
            layer: "alidade_smooth",
            retina: true,
          }),
        }),
        stationLayer,
      ],
      view: olView,
    });

    return () => {
      map.setTarget(null);
    };
  }, [geoJSON]);

  if (isLoading) {
    return (
      <>
        <div>Is Loading...</div>
      </>
    );
  }

  return (
    <>
      <TramMap
        lineData={lineData}
        stationData={stationData}
        tramData={tramData}
      ></TramMap>
    </>
  );
}
