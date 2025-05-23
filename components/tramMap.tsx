import {useEffect, useState, useRef, forwardRef} from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import StadiaMaps from "ol/source/StadiaMaps";
import * as OlProj from "ol/proj";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import {getDisruptions, getLineData, getStationData, getTramData, updateTramProgress, updateTramProgressInterpolated} from "../utils/dataUtils";
import Overlay from "ol/Overlay";
import styles from "../styles/tramMap.module.css";
import {Filter, Line, Station, Tram} from "../utils/types";
import {Feature, Geolocation} from "ol";
import {Point} from "ol/geom";
import {Coordinate} from "ol/coordinate";
import {Attribution} from "ol/control";
import {useTheme} from "next-themes";
import {lineStyle, locationStyle, stationStyle, tramStyle, userInZurich} from "../utils/mapUtils";
import {FocusOverlay} from "./symbols";
import {MapControlBar, MapControl, MapControlGroup} from "./controls";
import {GpsFix, Minus, NavigationArrow, Plus} from "@phosphor-icons/react";
import {DragRotateAndZoom, DblClickDragZoom, defaults as defaultInteractions} from "ol/interaction";
import {FeatureLike} from "ol/Feature";

// todo: integrate these somehow
export const timeOffset = 86400000 * -0;
export const histDate = ""; // ex: 2024-12-01 -> set offset to n days ago


export default function TramMap({onClick, filter, lineData, stationData, tramData, overlay, debug}: { onClick: (target: any, userLocation: Geolocation) => void; filter?: { trams?: Filter<string>, lines?: Filter<string>, stations?: Filter<string>}; lineData: Line[]; stationData: Station[]; tramData: Tram[]; overlay: any, debug: boolean }) {

	// STATES AND REFS

	const {theme} = useTheme();

	const [map, setMap] = useState<Map>(null);
	const [stadiaLayer, setStadiaLayer] = useState<TileLayer>();
	const [lineLayer, setLineLayer] = useState<VectorLayer>();
	const [stationLayer, setStationLayer] = useState<VectorLayer>();
	const [tramLayer, setTramLayer] = useState<VectorLayer>();
	const [userLocationLayer, setUserLocationLayer] = useState<VectorLayer>();
	const [overlayLayer, setOverlayLayer] = useState<Overlay>();

	const [userLocation, setUserLocation] = useState<Coordinate>(OlProj.fromLonLat([0, 0]));
	const [prevTramData, setPrevTramData] = useState<Tram[]>();
	const [geolocation, setGeolocation] = useState<any>();
	const [focus, setFocus] = useState<FeatureLike>(null);

	const [rotation, setRotation] = useState(0);

	const fps = 10;

	const overlayRef = useRef(null);

	// start view
	const view = new View({
		center: OlProj.fromLonLat([8.5417, 47.3769]),
		zoom: 15,
		maxZoom: 19,
		minZoom: 13,
		//extent: OlProj.fromLonLat([8.5417-0.15, 47.3769-0.08]).concat(OlProj.fromLonLat([8.5417+0.15, 47.3769+0.08]))
		extent: OlProj.fromLonLat([8.434571348267301, 47.28091645062872]).concat(OlProj.fromLonLat([8.718285360198345, 47.45672784732389]))
	});

	// OnClick function to update the view
	const centerView = () => {
		if (!userInZurich(userLocation)) return;
		map.getView().animate({
			center: userLocation,
			zoom: 16,
     		duration: 500
		})
	}

	const increaseZoom = () => {
		const oldZoom = map.getView().getZoom();
		map.getView().animate({
			zoom: Math.min(oldZoom + 1, map.getView().getMaxZoom()),
     		duration: 300
		})
	}

	const decreaseZoom = () => {
		const oldZoom = map.getView().getZoom();
		map.getView().animate({
			zoom: Math.max(oldZoom - 1, map.getView().getMinZoom()),
     		duration: 300
		})
	}

	const restoreRotation = () => {
		map.getView().animate({
			rotation: 0,
     		duration: 300
		})
	}

	// Get the users live location
	if (!geolocation) { // only once
		setGeolocation(new Geolocation({
			tracking: true,
			projection: view.getProjection()
		}));
	}

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
			style: lineStyle(filter.lines, focus)
		}))

		setStationLayer(new VectorLayer({
			className: "stations",
			visible: true,
			source: new VectorSource({
				features: new GeoJSON().readFeatures(getStationData(stationData), {
					featureProjection: view.getProjection(),
				}),
			}),
			style: stationStyle(filter.stations)
		}))

		setTramLayer(new VectorLayer({
			className: "trams",
			visible: true,
			source: new VectorSource({
				features: new GeoJSON().readFeatures(getTramData(tramData, lineData), {
					featureProjection: view.getProjection(),
				})
			}),
			style: tramStyle(filter.trams)
		}))

		setUserLocationLayer(new VectorLayer({
			className: "userLoc",
			visible: true,
			source: new VectorSource({
				features: [new Feature({
					geometry: new Point(userLocation)
				})]
			}),
			style: locationStyle
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
			})],
			interactions: defaultInteractions().extend([new DblClickDragZoom({delta: -0.01}), new DragRotateAndZoom()]),
		});

		newMap.addOverlay(overlayLayer)

		newMap.on("click", function (e) {

			console.log(OlProj.toLonLat(e.coordinate));

			let candidateFeatures = newMap.getFeaturesAtPixel(e.pixel);
			let tramCandidate = candidateFeatures.find(f => f.getProperties().type === "tram")
			let stationCandidate = candidateFeatures.find(f => f.getProperties().type === "station")
			let lineCandidate = candidateFeatures.find(f => f.getProperties().type === "line")

			if (tramCandidate) console.log(tramCandidate)
			if (stationCandidate) console.log(stationCandidate)
			if (lineCandidate) console.log(lineCandidate)

			let selectedFeature = tramCandidate || stationCandidate || (debug ? lineCandidate : undefined)

			setFocus(selectedFeature)
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
			})]
		}))
	}, [userLocation]);

	// theme
	useEffect(() => {
		stadiaLayer?.setSource(new StadiaMaps({
			layer: theme === "light" ? "alidade_smooth" : "alidade_smooth_dark",
			retina: true,
		}))
		lineLayer?.setStyle(lineStyle(filter.lines, focus))
		stationLayer?.setStyle(stationStyle(filter.stations))
		tramLayer?.setStyle(tramStyle(filter.trams))
	}, [theme, filter, focus]);

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

	// overlay position
	useEffect(() => {
		const interval = setInterval(() => {
			if (focus?.getProperties()?.type === "tram")
				overlayLayer?.setPosition(tramLayer?.getSource().getFeatures().find(f => f.getProperties().trip_id === focus?.getProperties().trip_id)?.getProperties()?.geometry?.flatCoordinates)
		}, 1000 / fps);
		return () => {
			clearInterval(interval)
		};
	}, [focus]);

	// rotation
	useEffect(() => {

		let view = map?.getView();

		//if (view?.getAnimating() || view?.getInteracting()) return;

		let x = 2 * Math.PI;
		let a = view?.getRotation() ?? 0;
		a = ((a % x) + x) % x
		if (a > Math.PI) a -= 2 * Math.PI;
		setRotation(a);
	}, [map?.getView()?.getRotation(), map?.getView()?.getAnimating(), map?.getView()?.getInteracting()]);

	return (
		<>
			<div className={styles.controls}>
				<MapControlBar style={{transition: ".3s"}}>
					<MapControlGroup fillColor={"var(--BG2)"}>
						<MapControl onClick={increaseZoom}><Plus color={"var(--FG1)"} weight={"bold"} size={16}></Plus></MapControl>
						<MapControl onClick={decreaseZoom}><Minus color={"var(--FG1)"} weight={"bold"} size={16}></Minus></MapControl>
					</MapControlGroup>
					<MapControl hidden={!userInZurich(userLocation)} onClick={centerView}><GpsFix color={"var(--LOC)"} weight={"bold"} size={16}></GpsFix></MapControl>
					<MapControl hidden={Math.abs(rotation) < 0.01} onClick={restoreRotation}><div style={{height: "16px", transform: "rotate(" + rotation + "rad)"/*, transition: "transform .3s"*/}}><NavigationArrow style={{transform: "rotate(45deg)"}} color={"var(--FG1)"} weight={"bold"} size={16}></NavigationArrow></div></MapControl>
				</MapControlBar>
			</div>
			<div ref={overlayRef}>
				<div className={styles.focus}>{focus && !(focus.getProperties().type === "line") && <FocusOverlay data={focus.getProperties()}></FocusOverlay>}</div>
				<div className={styles.overlay}>{overlay}</div>
			</div>
			<div className={styles.map} id="map"/>
		</>
	);
}