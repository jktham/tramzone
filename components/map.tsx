"use client"

import { useEffect, useState, useRef, memo, useMemo } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import StadiaMaps from "ol/source/StadiaMaps";
import * as OlProj from "ol/proj";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import {getLineData, getStationData, getTramData} from "../utils/dataUtils";
import Overlay from "ol/Overlay";
import styles from "../styles/tramMap.module.css";
import {Line, MapOptions, Segment, Station, Target, Tram} from "../utils/types";
import {Feature, Geolocation} from "ol";
import {Point} from "ol/geom";
import {Coordinate} from "ol/coordinate";
import {Attribution} from "ol/control";
import {useTheme} from "next-themes";
import {lineStyle, locationStyle, stationStyle, tramStyle, userInZurich} from "../utils/mapUtils";
import {TargetOverlay} from "./symbols";
import {Toolbar, ToolbarButton, ToolbarGroup} from "./controls";
import {DragRotateAndZoom, DblClickDragZoom, defaults as defaultInteractions} from "ol/interaction";
import {FeatureLike} from "ol/Feature";
import * as Extent from "ol/extent";
import { GpsFixIcon, MinusIcon, NavigationArrowIcon, PlusIcon } from "@phosphor-icons/react";

export type ClickTarget = FeatureLike;

// TODO: fix a bit to use <> for the type
const TramMap =  memo((
	{data, onClick, onUserLocation, onTargetLocation, target, options, overlay, debug}:
	{ data: { lines: Line[], stations: Station[], trams: Tram[] }; onClick: (target: Target, location: Coordinate) => void; onUserLocation: (location: Coordinate) => void; onTargetLocation: (location: Coordinate) => void; target?: Target, options?: MapOptions; overlay?: any, debug?: boolean }
) => {

	// STATES AND REFS

	const {theme} = useTheme();

	const [map, setMap] = useState<Map>(null);
	//const [stadiaLayer, setStadiaLayer] = useState<TileLayer>();
	const [lineLayer, setLineLayer] = useState<VectorLayer>();
	const [stationLayer, setStationLayer] = useState<VectorLayer>();
	const [tramLayer, setTramLayer] = useState<VectorLayer>();
	const [userLocationLayer, setUserLocationLayer] = useState<VectorLayer>();
	const [overlayLayer, setOverlayLayer] = useState<Overlay>();

	const [geolocation, setGeolocation] = useState<any>();
	const [userLocation, setUserLocation] = useState<Coordinate>(OlProj.fromLonLat([0, 0]));

	const [targetFeatures, setTargetFeatures] = useState<FeatureLike[]>([]);
	const [rotation, setRotation] = useState(0);

	const overlayRef = useRef(null);

	// start view
	const view = new View({
		center: OlProj.fromLonLat([8.5417, 47.3769]),
		zoom: 15,
		maxZoom: 19,
		minZoom: 13,
		extent: Extent.buffer(Extent.boundingExtent(data.stations.map(s => OlProj.fromLonLat(s.coords))), 3000)
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
	const stadiaLayer = useMemo(() =>
		new TileLayer({
			className: "base",
			source: new StadiaMaps({
				layer: theme === "light" ? "alidade_smooth" : "alidade_smooth_dark",
				retina: true,
			}),
		})
	, [theme])

	useEffect(() => {

		setLineLayer(new VectorLayer({
			className: "lines",
			visible: true,
			source: new VectorSource({
				features: new GeoJSON().readFeatures(getLineData(data.lines), {
					featureProjection: view.getProjection(),
				}),
			}),
			style: lineStyle(options.lineFilter, targetFeatures)
		}))

		setStationLayer(new VectorLayer({
			className: "stations",
			visible: true,
			source: new VectorSource({
				features: new GeoJSON().readFeatures(getStationData(data.stations), {
					featureProjection: view.getProjection(),
				}),
			}),
			style: stationStyle(options.stationFilter)
		}))

		setTramLayer(new VectorLayer({
			className: "trams",
			visible: true,
			source: new VectorSource({
				features: new GeoJSON().readFeatures(getTramData(data.trams, data.lines), {
					featureProjection: view.getProjection(),
				})
			}),
			style: tramStyle(options.tramFilter)
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

			let candidateFeatures = newMap.getFeaturesAtPixel(e.pixel);
			let tramCandidate = candidateFeatures.find(f => f.getProperties().type === "tram")
			let stationCandidate = candidateFeatures.find(f => f.getProperties().type === "station")
			let lineCandidate = candidateFeatures.find(f => f.getProperties().type === "line")

			let selectedFeature = tramCandidate || stationCandidate || (debug ? lineCandidate : undefined)
			let type = selectedFeature?.getProperties()?.type

			if (debug && type === "line") type = "segment"
			if (debug) console.log(...candidateFeatures)

			onClick(selectedFeature && {
				type: type,
				data: selectedFeature.getProperties()[type]
			}, selectedFeature?.getProperties()?.geometry?.flatCoordinates || e.coordinate)
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

	// user location
	useEffect(() => {
		onUserLocation(userLocation)
		userLocationLayer?.setSource(new VectorSource({
			features: [new Feature({
				geometry: new Point(userLocation),
			})]
		}))
	}, [userLocation]);

	// update filter and focus
	useEffect(() => {
		lineLayer?.setStyle(lineStyle(options.lineFilter, targetFeatures))
		stationLayer?.setStyle(stationStyle(options.stationFilter))
		tramLayer?.setStyle(tramStyle(options.tramFilter))
	}, [options, target]);

	// tram position
	useEffect(() => {
		tramLayer?.setSource(new VectorSource({
			features: new GeoJSON().readFeatures(getTramData(data.trams, data.lines), {
				featureProjection: view.getProjection(),
			})
		}))
	}, [data.trams]);

	// target
	const updateTargetFeaturesAndLocation = (types?: ("station" | "line" | "segment" | "tram")[]) => {
		if (!target || (types && !types.includes(target.type))) return;

		let features = []
		if (target.type === "station" && stationLayer) features = stationLayer.getSource().getFeatures().filter(f => f.getProperties().station === (target.data as Station))
		if (target.type === "line" && lineLayer) features = lineLayer.getSource().getFeatures().filter(f => f.getProperties().line === (target.data as Line))
		if (target.type === "segment" && lineLayer) features = lineLayer.getSource().getFeatures().filter(f => f.getProperties().segment === (target.data as Segment))
		if (target.type === "tram" && tramLayer) features = tramLayer.getSource().getFeatures().filter(f => f.getProperties().tram?.trip_id === (target.data as Tram)?.trip_id && (target.data as Tram) !== undefined)

		let location = features?.[0]?.getProperties()?.geometry?.flatCoordinates
		if (["line", "segment"].includes(target.type)) {
			let extent = features.map(f => f.getProperties().geometry.extent_).reduce((p, c) => Extent.extend(p, c), Extent.createEmpty())
			location = Extent.getCenter(extent)
		}
		onTargetLocation(location)
		overlayLayer?.setPosition(location)
		setTargetFeatures(features)
	}
	useEffect(() => {
		if (!target) return setTargetFeatures([]);
		updateTargetFeaturesAndLocation()
	}, [target]);
	useEffect(() => {
		updateTargetFeaturesAndLocation(["station"])
	}, [data.stations]);
	useEffect(() => {
		updateTargetFeaturesAndLocation(["line", "segment"])
	}, [data.lines]);
	useEffect(() => {
		updateTargetFeaturesAndLocation(["tram"])
	}, [data.trams]);


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
				<Toolbar style={{transition: ".3s"}}>
					<ToolbarGroup fillColor={"var(--BG2)"}>
						<ToolbarButton onClick={increaseZoom}><PlusIcon color={"var(--FG1)"} weight={"bold"} size={16}></PlusIcon></ToolbarButton>
						<ToolbarButton onClick={decreaseZoom}><MinusIcon color={"var(--FG1)"} weight={"bold"} size={16}></MinusIcon></ToolbarButton>
					</ToolbarGroup>
					<ToolbarButton hidden={!userInZurich(userLocation)} onClick={centerView}><GpsFixIcon color={"var(--LOC)"} weight={"bold"} size={16}></GpsFixIcon></ToolbarButton>
					<ToolbarButton hidden={Math.abs(rotation) < 0.01} onClick={restoreRotation}>
						<div style={{height: "16px", transform: "rotate(" + rotation + "rad)"/*, transition: "transform .3s"*/}}><NavigationArrowIcon style={{transform: "rotate(45deg)"}} color={"var(--FG1)"} weight={"bold"} size={16}></NavigationArrowIcon></div>
					</ToolbarButton>
				</Toolbar>
			</div>
			<div ref={overlayRef}>
				<div className={styles.target}>{target && (["tram", "station"].includes(target.type)) && <TargetOverlay target={target}></TargetOverlay>}</div>
				<div className={styles.overlay}>{overlay}</div>
			</div>
			<div className={styles.map} id="map"/>
		</>
	);
})

export default TramMap;