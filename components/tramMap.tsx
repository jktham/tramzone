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
import ol from "ol/dist/ol";
import { getStationData, getTramData, getLineData } from "../utils/dataUtils";

export default function TramMap({lineData, stationData, tramData}: { lineData: Line[]; stationData: Station[]; tramData: Tram[]; }) {

  const [map, setMap] = useState<Map>(null);

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
		source: new VectorSource({
			features: new GeoJSON().readFeatures(getLineData(lineData), {
				featureProjection: view.getProjection(),
			}),
		}),
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
		source: new VectorSource({
			features: new GeoJSON().readFeatures(getStationData(stationData), {
				featureProjection: view.getProjection(),
			}),
		}),
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
		className: "trams",
		visible: true,
		source: new VectorSource({
			features: new GeoJSON().readFeatures(getTramData(tramData, lineData), {
				featureProjection: view.getProjection(),
			})
		}),
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
		map?.getAllLayers().find((v) => v.getClassName().startsWith("trams"))?.setSource(new VectorSource({
			features: new GeoJSON().readFeatures(getTramData(tramData, lineData), {
				featureProjection: view.getProjection(),
			})
		}))
	}, [tramData]);

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
			let selectedFeature;
            let hasTramFeatures = map.hasFeatureAtPixel(e.pixel, {layerFilter: function(layerCandidate) {
                return layerCandidate.getClassName() === "trams";
            }});
            let hasStationFeatures = map.hasFeatureAtPixel(e.pixel, {layerFilter: function(layerCandidate) {
                return layerCandidate.getClassName() === "stations";
            }});
            let hasLineFeatures = map.hasFeatureAtPixel(e.pixel, {layerFilter: function(layerCandidate) {
                return layerCandidate.getClassName() === "lines";
            }});

			map.forEachFeatureAtPixel(e.pixel, function (feature, layer) {
                let layerClassName = layer.getClassName();
                if (selectedFeature) {}
                else {
                if (!hasTramFeatures && !hasStationFeatures) {selectedFeature = feature;}
                else if (!hasTramFeatures) {
                    if (layerClassName === "stations") {selectedFeature = feature;}
                }
                else {
                    if (layerClassName === "trams") selectedFeature = feature;
                }
                }
                let clickedCoords = e.coordinate;
                console.log(layer.getClassName());
                overlayLayer.setPosition(clickedCoords);
            });
            console.log(selectedFeature.values_.name);
		});

		setMap(map)

		return () => {
			map.setTarget(null);
			setMap(null);
		};
	}, []);

	return (
		<>
			<div id="map" style={{width: "100%", height: "100%"}}/>
		</>
	);
}
