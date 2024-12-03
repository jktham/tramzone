import React, { useEffect } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector.js";
import StadiaMaps from "ol/source/StadiaMaps.js";
import OSM from "ol/source/OSM";
import * as OlProj from "ol/proj";
import useSWR from "swr";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";

export default function Home() {
  const { data, error, isLoading } = useSWR("api/stations", (url) =>
    fetch(url).then((res) => res.json())
  );
  const getSationData = async (data) => {
    let geoJson = { type: "FeatureCollection", features: [] };
    for (let point in data) {
      let coordinates = point.coords;
      let properties = point.name;
      // delete properties.coords;
      let feature = {
        type: "Feature",
        geometry: { type: "Point", coordinates: coordinates },
        properties: properties,
      };
      geoJson.features.push(feature);
    }
    return geoJson;
  };

  useEffect(() => {
    const geoJSON = getSationData(data);

    const stationLayer = new VectorLayer({
      source: new VectorSource({
        features: data,
        format: new GeoJSON(),
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
    });

    map.setView(
      new View({
        center: OlProj.fromLonLat([8.5417, 47.3769]),
        zoom: 15,
      })
    );

    return () => {
      map.setTarget(null);
    };
  }, []);

  return (
    <>
      <div id="map" style={{ width: "100%", height: "100%" }} />
    </>
  );
}
