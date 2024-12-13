import {useEffect, useState, useRef, forwardRef} from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import StadiaMaps from "ol/source/StadiaMaps";
import OSM from "ol/source/OSM";
import * as OlProj from "ol/proj";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Style from "ol/style/Style.js";
import {Circle, Fill, Stroke} from "ol/style.js";
import {getInterpolatedTramData, getLineData, getStationData, getTramData, updateTramProgress} from "../utils/dataUtils";
import Overlay from "ol/Overlay";
import styles from "../styles/tramMap.module.css";
import { Line, Station, Tram } from "../utils/types";
import { Feature, Geolocation } from "ol";
import { Point } from "ol/geom";
import { Coordinate } from "ol/coordinate";

// TODO: what is type of target (in onClick) / focus should we even define that?
export default function TramMap({onClick, focus, filter, lineData, stationData, tramData} : { onClick : (target : any) => void; focus : any; filter : {}; lineData : Line[]; stationData : Station[]; tramData : Tram[]; }) {
    // STATES AND REFS
    const [map, setMap] = useState<Map>(null);
	const [userLocation, setUserLocation] = useState<Coordinate>([0,0]);

	/*const [currTramData, setCurrTramData] = useState(null); // OTHER METHOD
	const [prevTramData, setPrevTramData] = useState(null);*/
	const fps = 60;

    const overlayRef = useRef(null);

    // SET UP THE MAP
	const view = new View({
		center: OlProj.fromLonLat([8.5417, 47.3769]),
		zoom: 15,
	});

	// Get the users live location
	var geolocation = new Geolocation({
		tracking: true,
		projection: view.getProjection()
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
		className: "lines",
		visible: true,
		source: new VectorSource({
			features: new GeoJSON().readFeatures(getLineData(lineData), {
				featureProjection: view.getProjection(),
			}),
		}),
		style: (feature) =>
			new Style({
				stroke: new Stroke({
					width: 3,
					color: feature.get("color"),
				}),
			}),
	});

	const stationLayer = new VectorLayer({
		className: "stations",
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
					color: "#F2F3F0",
				}),
				stroke: new Stroke({
					width: 3,
					color: "#000000"
				})
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
					stroke: new Stroke({
						width: 3,
						color: "#F2F3F0"
					})
				}),
			}),
	});

	const userLocationLayer = new VectorLayer({
		className: "userLoc",
		visible: true,
		source: new VectorSource({
			features: [new Feature({
				geometry: new Point(userLocation)
			})]
		}),
		style: new Style({
			image: new Circle({
				radius: 10,
				fill: new Fill({
					color: "#000000",
				}),
				stroke: new Stroke({
					width: 3,
					color: "#000000"
				})
			}),
		}),
		
	});

	// Add the current live position of the user to the map
	useEffect(() => {
		map?.getAllLayers().find((v) => v.getClassName().startsWith("userLoc"))?.setSource(new VectorSource({
			features: [new Feature({
				geometry: new Point(userLocation)
			})]
		}))
	}, [userLocation]);

	/*
			map?.getAllLayers().find((v) => v.getClassName().startsWith("trams"))?.setSource(new VectorSource({
			features: new GeoJSON().readFeatures(getTramData(tramData, lineData), {
				featureProjection: view.getProjection(),
			})
		}))
	 */

	useEffect(() => {
		//Implementing the setInterval method
		const interval = setInterval(() => {

			// OTHER METHOD
			/*map?.getAllLayers().find((v) => v.getClassName().startsWith("trams"))?.setSource(new VectorSource({
				features: new GeoJSON().readFeatures(getInterpolatedTramData(prevTramData, currTramData, lineData), {
					featureProjection: view.getProjection(),
				})
			}))*/
			map?.getAllLayers().find((v) => v.getClassName().startsWith("trams"))?.setSource(new VectorSource({
				features: new GeoJSON().readFeatures(getTramData(updateTramProgress(tramData, (new Date()).valueOf()), lineData), {
					featureProjection: view.getProjection(),
				})
			}))
		}, 1000 / fps);

		//Clearing the interval
		return () => clearInterval(interval);
	}, [tramData]);

	// OTHER METHOD
	/*useEffect(() => {
		setPrevTramData(currTramData)
		setCurrTramData(tramData)
	}, [tramData]);*/

	useEffect(() => {
		const map = new Map({
			target: "map",
			layers: [osmLayer, lineLayer, stationLayer, tramLayer, userLocationLayer],
		});

		map.setView(
			new View({
				center: OlProj.fromLonLat([8.5417, 47.3769]),
				zoom: 15,
			})
		);


        const overlayLayer = new Overlay({
            element:overlayRef.current
          });
        map.addOverlay(overlayLayer);

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
                overlayLayer.setPosition(clickedCoords);

            });
			onClick(selectedFeature);
		});

		geolocation.on("change", function (e) {
			var loc = geolocation.getPosition();
			console.log(loc);
			setUserLocation(loc);
		})

		setMap(map)

		return () => {
			map.setTarget(null);
			setMap(null);
		};
	}, []);

	return (
		<>
			<div className={styles.map} id="map" />
		</>
	);
}