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
import {getLineData, getStationData, getTramData, updateTramProgress, updateTramProgressInterpolated} from "../utils/dataUtils";
import Overlay from "ol/Overlay";
import styles from "../styles/tramMap.module.css";
import { Line, Station, Tram } from "../utils/types";
import { Feature, Geolocation } from "ol";
import { Point } from "ol/geom";
import { Coordinate } from "ol/coordinate";
import {Attribution} from "ol/control";
import {useTheme} from "next-themes";

// TODO: what is type of target (in onClick) / focus should we even define that?
export default function TramMap({onClick, focus, filter, lineData, stationData, tramData, overlay} : { onClick : (target : any) => void; focus : any; filter : {}; lineData : Line[]; stationData : Station[]; tramData : Tram[]; overlay : any}) {
    // STATES AND REFS
    const [map, setMap] = useState<Map>(null);
	const [userLocation, setUserLocation] = useState<Coordinate>([0,0]);
	const {theme, setTheme} = useTheme();
	const [prevTramData, setPrevTramData] = useState<Tram[]>();

	const fps = 10;

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
		className: "base",
		source: new StadiaMaps({
			layer: theme === "light" ? "alidade_smooth" : "alidade_smooth_dark",
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
					color: "#606060"
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
		style: [new Style({
				image: new Circle({
					radius: 6.5,
					fill: new Fill({
						color: "rgba(45,110,133,1)",
					})
				})
			}), new Style({
				image: new Circle({
					radius: 9.5,
					fill: new Fill({
						color: "rgba(45,110,133,0.3)",
					})
				})
			}),
		]
	});

	// Add the current live position of the user to the map
	useEffect(() => {
		map?.getAllLayers().find((v) => v.getClassName().startsWith("userLoc"))?.setSource(new VectorSource({
			features: [new Feature({
				geometry: new Point(userLocation)
			})]
		}))
	}, [userLocation]);

	useEffect(() => {
		map?.getAllLayers().find((v) => v.getClassName().startsWith("base"))?.setSource(new StadiaMaps({
			layer: theme === "light" ? "alidade_smooth" : "alidade_smooth_dark",
			retina: true,
		}))
	}, [theme]);

	useEffect(() => {
		const interval = setInterval(() => {
			let newTramData = updateTramProgressInterpolated(tramData, prevTramData, (new Date()).valueOf() + (-86400000 * 0));
			map?.getAllLayers().find((v) => v.getClassName().startsWith("trams"))?.setSource(new VectorSource({
				features: new GeoJSON().readFeatures(getTramData(newTramData, lineData), {
					featureProjection: view.getProjection(),
				})
			}))
			setPrevTramData(JSON.parse(JSON.stringify(newTramData)));
		}, 1000 / fps);
		return () => {
			clearInterval(interval)
		};
	}, [tramData, prevTramData]);

	useEffect(() => {

		const attr = new Attribution({
			className: styles.attribution,
			collapsible: false
		})

		const map = new Map({
			target: "map",
			layers: [stadiaLayer, lineLayer, stationLayer, tramLayer, userLocationLayer],
			controls: [attr]
		});

		const overlayLayer = new Overlay({
			className: "overlay",
			element: overlayRef.current
		});
		map.addOverlay(overlayLayer)

		map.setView(
			new View({
				center: OlProj.fromLonLat([8.5417, 47.3769]),
				zoom: 15,
			})
		);

		map.on("click", function (e) {
			/*let selectedFeature;
            let hasTramFeatures = map.hasFeatureAtPixel(e.pixel, {layerFilter: function(layerCandidate) {
                return layerCandidate.getClassName() === "trams";
            }});
            let hasStationFeatures = map.hasFeatureAtPixel(e.pixel, {layerFilter: function(layerCandidate) {
                return layerCandidate.getClassName() === "stations";
            }});
            let hasLineFeatures = map.hasFeatureAtPixel(e.pixel, {layerFilter: function(layerCandidate) {
                return layerCandidate.getClassName() === "lines";
            }});*/

			let candidateFeatures = map.getFeaturesAtPixel(e.pixel);
			let tramCandidate = candidateFeatures.find(f => f.getProperties().type === "tram")
			let stationCandidate = candidateFeatures.find(f => f.getProperties().type === "station")
			let lineCandidate = candidateFeatures.find(f => f.getProperties().type === "line")

			/*map.forEachFeatureAtPixel(e.pixel, function (feature, layer) {
				let layerClassName = layer.getClassName();
				if (selectedFeature) {
				} else {
					if (!hasTramFeatures && !hasStationFeatures) {
						selectedFeature = feature;
					} else if (!hasTramFeatures) {
						if (layerClassName === "stations") {
							selectedFeature = feature;
						}
					} else {
						if (layerClassName === "trams") selectedFeature = feature;
					}
				}
			});*/

			// TODO: in case this is a tram, update overlayPosition constantly
			//		 in case it is a line, always use e.coordinate

			let selectedFeature = tramCandidate || stationCandidate || lineCandidate
			console.log(selectedFeature);

			onClick(selectedFeature);
			overlayLayer.setPosition(selectedFeature?.getProperties()?.geometry?.flatCoordinates || e.coordinate)
		});

		geolocation.on("change", function (e) {
			var loc = geolocation.getPosition();
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
			<div ref={overlayRef}>{overlay}</div>
			<div className={styles.map} id="map" />
		</>
	);
}