import {useEffect} from "react";
import "ol/ol.css";
import Map from 'ol/Map';
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import StadiaMaps from 'ol/source/StadiaMaps';
import OSM from 'ol/source/OSM'
import * as OlProj from "ol/proj";
import {grayscaleLayer} from "../utils/mapUtils";
import RenderEvent from "ol/render/Event";


export default function TramMap({lineData, stationData, tramData} : any) {

	const stadia = new TileLayer({
		source: new StadiaMaps({
			layer: 'alidade_smooth',
			retina: true
		})
	})

	const osm = new TileLayer({
		source: new OSM()
	});
	osm.on("postrender", function(event : RenderEvent) {
		grayscaleLayer(event.context);
	});

	useEffect(() => {
		const map = new Map({
			target: "map",
			layers: [osm]
		});

		map.setView(new View({
			center: OlProj.fromLonLat([8.5417, 47.3769]),
			zoom: 15,
		}));

		return () => {
			map.setTarget(null);
		};
	}, []);

	return <>
		<div id="map" style={{width: "100%", height: "100%"}}/>
	</>
}
