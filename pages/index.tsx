
import React, { useEffect } from "react";
import "ol/ol.css";
import Map from 'ol/Map';
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";

export default function Home() {

	useEffect(() => {
		const map = new Map({
			target: "map",
			layers: [
				new TileLayer({
					source: new OSM(),
				}),
			]/*,
			view: new View({
				center: [0, 0],
				zoom: 2,
			}),*/
		});

		map.setView(new View({
			center: [0, 0],
			zoom: 2,
		}));

		return () => {
			map.setTarget(null);
		};
	}, []);

	return (
		<>
			<div id="map" style={{width: "100%", height: "400px"}}/>
		</>
	)
}