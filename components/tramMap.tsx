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
import {Line, Station, Tram} from "../utils/types";
import {Feature, Geolocation} from "ol";
import {Point} from "ol/geom";
import {Coordinate} from "ol/coordinate";
import {Attribution} from "ol/control";
import {useTheme} from "next-themes";
import {lineStyle, locationStyle, stationStyle, tramStyle} from "../utils/mapUtils";

// todo: integrate these somehow
export const timeOffset = 86400000 * -0;
export const histDate = ""; // ex: 2024-12-01 -> set offset to n days ago

// TODO: what is type of target (in onClick) / focus should we even define that?
export default function TramMap({onClick, focus, filter, lineData, stationData, tramData, overlay}: { onClick: (target: any, userLocation : Geolocation) => void; focus: any; filter: {}; lineData: Line[]; stationData: Station[]; tramData: Tram[]; overlay: any }) {

	// STATES AND REFS

	const {theme, setTheme} = useTheme();

	const [map, setMap] = useState<Map>(null);
	const [stadiaLayer, setStadiaLayer] = useState<TileLayer>();
	const [lineLayer, setLineLayer] = useState<VectorLayer>();
	const [stationLayer, setStationLayer] = useState<VectorLayer>();
	const [tramLayer, setTramLayer] = useState<VectorLayer>();
	const [userLocationLayer, setUserLocationLayer] = useState<VectorLayer>();
	const [overlayLayer, setOverlayLayer] = useState<Overlay>();

	const [userLocation, setUserLocation] = useState<Coordinate>([0, 0]);
	const [prevTramData, setPrevTramData] = useState<Tram[]>();

	const fps = 10;

	const overlayRef = useRef(null);

	// start view
	const view = new View({
		center: OlProj.fromLonLat([8.5417, 47.3769]),
		zoom: 15,
	});

	// Get the users live location
	let geolocation = new Geolocation({
		tracking: true,
		projection: view.getProjection()
	});

	// INITIALIZE MAP

	// layers
	useEffect(() => {

		setStadiaLayer(new TileLayer({
			className: "base",
			source: new StadiaMaps({
				layer: theme === "light" ? "alidade_smooth" : "alidade_smooth_dark",
				retina: true,
			}),
		}))

		setLineLayer(new VectorLayer({
			className: "lines",
			visible: true,
			source: new VectorSource({
				features: new GeoJSON().readFeatures(getLineData(lineData), {
					featureProjection: view.getProjection(),
				}),
			}),
			style: lineStyle(filter, focus)
		}))

		setStationLayer(new VectorLayer({
			className: "stations",
			visible: true,
			source: new VectorSource({
				features: new GeoJSON().readFeatures(getStationData(stationData), {
					featureProjection: view.getProjection(),
				}),
			}),
			style: stationStyle(filter, focus)
		}))

		setTramLayer(new VectorLayer({
			className: "trams",
			visible: true,
			source: new VectorSource({
				features: new GeoJSON().readFeatures(getTramData(tramData, lineData), {
					featureProjection: view.getProjection(),
				})
			}),
			style: tramStyle(filter, focus)
		}))

		setUserLocationLayer(new VectorLayer({
			className: "userLoc",
			visible: true,
			source: new VectorSource({
				features: [new Feature({
					geometry: new Point(userLocation)
				})]
			}),
			style: locationStyle(filter, focus)
		}))

		setOverlayLayer(new Overlay({
			element: overlayRef.current
		}))

	}, [])

	// map
	useEffect(() => {

		if (!(stadiaLayer && lineLayer && stationLayer && tramLayer && userLocationLayer && overlayLayer)) return;

		const newMap = new Map({
			target: "map",
			view: view,
			layers: [stadiaLayer, lineLayer, stationLayer, tramLayer, userLocationLayer],
			controls: [new Attribution({
				className: styles.attribution,
				collapsible: false,
				collapsed: false,
				collapseLabel: ""
			})]
		});

		newMap.addOverlay(overlayLayer)

		newMap.on("click", function (e) {

			let candidateFeatures = newMap.getFeaturesAtPixel(e.pixel);
			let tramCandidate = candidateFeatures.find(f => f.getProperties().type === "tram")
			let stationCandidate = candidateFeatures.find(f => f.getProperties().type === "station")
			let lineCandidate = undefined// candidateFeatures.find(f => f.getProperties().type === "line")

			// TODO: in case this is a tram, update overlayPosition constantly
			//		 in case it is a line, always use e.coordinate

			let selectedFeature = tramCandidate || stationCandidate || lineCandidate

			onClick(selectedFeature, geolocation);
			overlayLayer.setPosition(selectedFeature?.getProperties()?.geometry?.flatCoordinates || e.coordinate)
		});

		geolocation.on("change", function (e) {
			var loc = geolocation.getPosition();
			setUserLocation(loc);
		})

		if (map) console.warn("Map re-rendered")

		setMap(newMap)

		return () => {
			newMap.setTarget(null);
			setMap(null);
		};
	}, [stadiaLayer, lineLayer, stationLayer, tramLayer, userLocationLayer, overlayLayer]);

	// UPDATES

	// location
	useEffect(() => {
		userLocationLayer?.setSource(new VectorSource({
			features: [new Feature({
				geometry: new Point(userLocation),
				type: "userLoc"
			})]
		}))
	}, [userLocation]);

	// theme
	useEffect(() => {
		stadiaLayer?.setSource(new StadiaMaps({
			layer: theme === "light" ? "alidade_smooth" : "alidade_smooth_dark",
			retina: true,
		}))
		lineLayer?.setStyle(lineStyle(filter, focus))
		stationLayer?.setStyle(stationStyle(filter, focus))
		tramLayer?.setStyle(tramStyle(filter, focus))
	}, [theme]);

	// tram position
	useEffect(() => {
		const interval = setInterval(() => {
			let newTramData = updateTramProgressInterpolated(tramData, prevTramData, new Date().getTime() + timeOffset);
			tramLayer?.setSource(new VectorSource({
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

	return (
		<>
			<div ref={overlayRef}>{overlay}</div>
			<div className={styles.map} id="map"/>
		</>
	);
}