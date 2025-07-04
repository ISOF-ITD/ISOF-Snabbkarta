import React from 'react';
import _ from 'underscore';
import L from 'leaflet';
import 'leaflet.vectorgrid';
import 'leaflet.markercluster';

window._ = _;

import MapBase from './../../ISOF-React-modules/components/views/MapBase';

import InformationButton from './../../ISOF-React-modules/components/views/InformationButton';
import InformationOverlay from './../../ISOF-React-modules/components/views/InformationOverlay';

//import HelpButton from './../../ISOF-React-modules/components/views/HelpButton';
//import HelpOverlay from './../../ISOF-React-modules/components/views/HelpOverlay';

import EventBus from 'eventbusjs';

export default class Application extends React.Component {
	constructor(props) {
		super(props);

		// Lägg till globalt eventBus variable för att skicka data mellan moduler
		window.eventBus = EventBus;

		this.searchBoxChangeHandler = this.searchBoxChangeHandler.bind(this);

		this.searchTextSelectChangeHandler = this.searchTextSelectChangeHandler.bind(this);

		// Registrera kartan som object i window så man kan komma åt det i Developer Console
		window.isofKarta = this;

		this.layerProcessIndex = 0;

		this.leafletLayers = {};
		this.layerData = {};

		this.state = {
			layers: [],
			searchBoxVisible: false,
			showHelpPopup: false,
		};
	}


	searchBoxChangeHandler() {
		this.search();
	}

	searchTextSelectChangeHandler() {
		let searchBox = document.getElementById("search-field");
		if (searchBox.value.length > 0) {
			this.search();
		}
	}


	search() {

		//TODO: Bryta ut funktion. 
		function returnHighest(coordinate1, coordinate2) {
			return Math.max(coordinate1, coordinate2);
		}

		//TODO: Bryta ut funktion. 
		function returnLowest(coordinate1, coordinate2) {
			return Math.min(coordinate1, coordinate2);
		}

		let selected = document.getElementById("selected");
		let searchBox = document.getElementById("search-field");
		let searchTerms = searchBox.value.toLowerCase().split(' ');
		let hitsString = "";
		let minX = 180;
		let minY = 90;
		let maxX = -180;
		let maxY = -90;
		for (var layer in this.layerData) {
			let idSet = new Set();  
			if (this.layerData[layer]) {

				// Hittar layer objektet som vi ska söka
				var searchLayer = this.layerData[layer];

				if (searchBox.value.length > 0) {
					this.addGeoJsonData(searchLayer.config, searchLayer.data, function (feature) {
						var found = false;

						// Söker i varje searchFields som defineras i config filen
						_.each(searchLayer.config.searchFields, function (searchField) {

							// Handle layers with different object ids:
							let hitId = null;
							if (feature.id) {
								hitId = feature.id;
							} else if (feature.properties && feature.properties.id) {
								hitId = feature.properties.id;
							} else if (feature.properties && feature.properties.OGR_FID) {
								hitId = feature.properties.OGR_FID;
							} else if (feature.properties && feature.properties.fid) {
								hitId = feature.properties.fid;
							}

							// Mainly for Ölandskartan: Sökresultat som börjar på huvudled. 
							if (selected.options[selected.selectedIndex].value == 'mainpart') {
								if (feature.properties["hl"]) {
									if (feature.properties["hl"].toLowerCase().substr(0, searchBox.value.length) === searchBox.value.toLowerCase()) {
										found = true;
										minX = returnLowest(minX, feature.geometry.coordinates[0]);
										minY = returnLowest(minY, feature.geometry.coordinates[1]);
										maxX = returnHighest(maxX, feature.geometry.coordinates[0]);
										maxY = returnHighest(maxY, feature.geometry.coordinates[1]);
										idSet.add(hitId); 
									}
								}
							} else {
								if (selected.options[selected.selectedIndex].value === 'endswith') {
									if (feature.properties[searchField].toLowerCase().substr(feature.properties[searchField].length - searchBox.value.length) === searchBox.value.toLowerCase()) {
										found = true;
										minX = returnLowest(minX, feature.geometry.coordinates[0]);
										minY = returnLowest(minY, feature.geometry.coordinates[1]);
										maxX = returnHighest(maxX, feature.geometry.coordinates[0]);
										maxY = returnHighest(maxY, feature.geometry.coordinates[1]);
										idSet.add(hitId); 
									}
								}
								else if (selected.options[selected.selectedIndex].value === 'startswith') {
									if (feature.properties[searchField].toLowerCase().substr(0, searchBox.value.length) === searchBox.value.toLowerCase()) {
										found = true;
										minX = returnLowest(minX, feature.geometry.coordinates[0]);
										minY = returnLowest(minY, feature.geometry.coordinates[1]);
										maxX = returnHighest(maxX, feature.geometry.coordinates[0]);
										maxY = returnHighest(maxY, feature.geometry.coordinates[1]);
										idSet.add(hitId); 
									}
								}
								else {
									function hasHit(searchTerm) { // Ändrad parameter från searchTerms till searchTerm
										if (feature.properties[searchField]) {
											// Ignore hits within html-tags if searchField contains html
											let value = feature.properties[searchField];
											if (/<[a-z][\s\S]*>/i.test(value)) {
												// Remove <a> tags and their content
												value = value.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '');
												// Remove <th> tags and their content
												value = value.replace(/<th\b[^>]*>[\s\S]*?<\/th>/gi, '');
												// Remove other HTML tags
												value = value.replace(/<[^>]*>/g, '');
											}
											return value.toLowerCase().includes(searchTerm);
										}
										return false;
									}
	
									if (searchTerms.every(hasHit)) {
										found = true;
										minX = returnLowest(minX, feature.geometry.coordinates[0]);
										minY = returnLowest(minY, feature.geometry.coordinates[1]);
										maxX = returnHighest(maxX, feature.geometry.coordinates[0]);
										maxY = returnHighest(maxY, feature.geometry.coordinates[1]);
										idSet.add(hitId); 
									}
								}
							}
						});
						return found;
					});
				}
				else { // När sökfältet är tomt
					this.addGeoJsonData(searchLayer.config, searchLayer.data);
				}
			}
	
			hitsString += idSet.size + ' träffar i ' + this.layerData[layer].config.name + '<br/>';
		}
	
		document.getElementById("hits").innerHTML = hitsString;
	
		if (minX !== 180 && minY !== 90 && maxX !== -180 && maxY !== -90) {
			var southWest = L.latLng(minY, minX);
			var northEast = L.latLng(maxY, maxX);
			var bounds = L.latLngBounds(southWest, northEast);
			this.map.fitBounds(bounds, { padding: [50, 50] });
		}
		else {
			// Återställ till standardvy om inga sökresultat finns
			if (this.state.config && this.state.config.center && this.state.config.zoom) {
				this.map.setView(this.state.config.center, this.state.config.zoom);
			}
		}
	}
	

	createStyleSheet() {
		// Lägger till stylesheet
		var style = document.createElement("style");

		// WebKit hack :(
		style.appendChild(document.createTextNode(""));

		// Add the <style> element to the page
		document.head.appendChild(style);

		return style.sheet;
	}

	componentDidMount() {
		this.map = this.refs.map.map;
		window.snabbKarta = this;
		window.map = this.map;

		this.customStyleSheet = this.createStyleSheet();

		if (window.location.search.indexOf('?config=') > -1) {
			var configFile = window.location.search.split('=')[1];

			// Laddar config.json filen
			fetch('config/' + configFile)
				.then(function (response) {
					return response.json()
				}).then(function (json) {
					if (json.config) {
						// Konfigurerar kartan utifrån config filen
						this.configMap(json.config);
					}

					// Lägger till alla layers som finns i config filen
					this.addLayers(json.layers);
				}.bind(this)).catch(function (ex) {
					console.log('parsing failed', ex)
				})
				;
		}
	}

	configMap(config) {
		// Konfigurerar kartan, setView till center och zoom som kan finnas i config filen
		this.setState({
			config: config
		});
		if (config.center || config.zoom) {
			this.refs.map.map.setView(config.center || this.refs.map.map.getCenter(), config.zoom || this.refs.map.map.getZoom());
		}
	}

	addLayers(layers) {
		// Lägger till layers från config filen
		this.setState({
			layers: layers
		});

		// Går igenom alla layers och lägger varje till kartan
		_.each(layers, function (layer, index) {
			// Filtrerar bort dem som har hidden = true
			if (layer.hidden) {
				return;
			}

			// Kör rätt function för varje typ av layer
			var layerType = layer.type.toLowerCase();

			if (layerType == 'geojson') {
				this.addGeoJson(layer);
			}
			if (layerType == 'vectorgrid') {
				this.addVectorGrid(layer);
			}
			if (layerType == 'wms') {
				this.addWMSLayer(layer);
			}
		}.bind(this));
	}

	addLayer(layer, layerConfig) {
		// Lägger layer till kartan
		layer.addTo(this.refs.map.map);
		this.refs.map.layersControl.addOverlay(layer, layerConfig.name, true);

		if ((layerConfig.markerStyle && layerConfig.markerStyle.fillColor) || layerConfig.menuColor) {
			// Skapar css rule till customStyleSheet objectet, används för att visa färgsymbol i layers menyn
			var color = (layerConfig.markerStyle && layerConfig.markerStyle.fillColor) ? layerConfig.markerStyle.fillColor : layerConfig.menuColor;
			var styleRule = '.map-wrapper .leaflet-control-container .leaflet-control-layers .leaflet-control-layers-overlays label:nth-child(' + (this.layerProcessIndex + 1) + ') span:before {' +
				'content: " ";' +
				'display: inline-block;' +
				'position: relative;' +
				'top: 4px;' +
				'margin: 0 5px;' +
				'width: 20px;' +
				'height: 20px;' +
				'border-radius: 3px;' +
				'background-color: ' + color + ';'
			'}';

			this.customStyleSheet.insertRule(styleRule);
		}

		this.layerProcessIndex++;
	}

	//Example https://leafletjs.com/examples/choropleth/
	// https://stackoverflow.com/questions/34858377/leaflet-how-to-style-polygons-from-geojson-data
	//Not used yet
	getAreaColor(feature){
		console.log(feature)
		  switch (feature.properties.Name){
			case 'Area One' : return 'blue' ;
		  case 'Area Two' : return 'yellow' ;
			  break;
		}
	  };

	//Example https://leafletjs.com/examples/choropleth/
	// https://stackoverflow.com/questions/34858377/leaflet-how-to-style-polygons-from-geojson-data
	//Not used yet
 	areaStyle(feature){
		  return {
			fillColor: getAreaColor(feature),
		  weight: 2,
		  opacity: 1,
		  color: 'white',
		  dashArray: '3',
		  fillOpacity: 0.5
		}
	  };

	addGeoJson(layerConfig) {
		// Lägger till geoJson layer

		if (layerConfig.searchable) {
			// Om layeren är sökbar sparar vi information om det i state
			this.setState({
				searchBoxVisible: true,
				searchLayer: {
					layerId: layerConfig.layerId,
					searchFields: layerConfig.searchFields
				}
			});
		}


		if (layerConfig.searchTextSelect) {
			// Meny till sökboxen. 
			this.setState({
				searchTextSelectVisible: true,

			});
		}

		if (layerConfig.searchTextSelectExtended) {
			// Meny till sökboxen. 
			this.setState({
				searchTextSelectExtendedVisible: true,

			});
		}

		fetch(layerConfig.url)
			.then(function (response) {
				return response.json()
			}).then(function (json) {
				this.layerData[layerConfig.layerId] = {
					config: layerConfig,
					data: json
				};

				// Lägger till själva layern
				this.addGeoJsonData(layerConfig, json);
			}.bind(this)).catch(function (ex) {
				console.log('parsing failed', ex)
			})
			;
	}

	addGeoJsonData(layerConfig, data, filter) {
		// Lägger till geoJsonLayer, tar den bort först om den redan finns
		// Här kan man lägga till filter function för att filtrera features, sökfunktionen lägger till filter till addGeoJsonData

		/*
		Test filtrering, körs i developer tools:
	
		isofKarta.addGeoJsonData(isofKarta.layerData.agonamn_oland.config, isofKarta.layerData.agonamn_oland.data, function(feature) {
			return feature.geometry.coordinates[1] < 56.4160;
		})
	
		isofKarta.addGeoJsonData(isofKarta.layerData.agonamn_oland.config, isofKarta.layerData.agonamn_oland.data, function(feature) {
			return feature.properties.Namn.indexOf('skog') > -1;
		})
	
		*/

		if (this.leafletLayers[layerConfig.layerId]) {
			this.refs.map.layersControl.removeLayer(this.leafletLayers[layerConfig.layerId]);
			this.refs.map.map.removeLayer(this.leafletLayers[layerConfig.layerId]);
		}

		// 
		var options = {
			onEachFeature: function (feature, marker) {
				if (layerConfig.popupTemplate && layerConfig.popupExpanded) {
					marker.bindPopup(function (layer) {
						var template = _.template(layerConfig.popupTemplate);
						return template(feature.properties);
					}, {
						maxWidth: 400,
						minWidth:200,
						autoPanPadding: [90, 90],
					});
					// To avoid too large display extent of video files set smaller maximum extent: {maxWidth: 700, minWidth:200}
					// See also popupTemplate in www/config/APP-NAME.json
					// Example in ortnamn-tecken.json:
					// <div class="leaflet-popup-content" style="width: 701px;"><h2>Östersund</h2><video autoplay="" id="teckenfilnamn" controls="" muted="" style="max-width: 400px;max-height: 300px;z-index: 600">
				}
			},
			pointToLayer: function (geoJsonPoint, latlng) {
				if (layerConfig.markerStyle && layerConfig.markerStyle.type == 'circle') {
					var divIcon = L.divIcon({
						html: '<div class="map-circle-marker" style="border-radius: 100%;' +
							'width: ' + (layerConfig.markerStyle.radius * 2 || 20) + 'px;' +
							'height: ' + (layerConfig.markerStyle.radius * 2 || 20) + 'px;' +
							'background-color: ' + (layerConfig.markerStyle.fillColor || '#af0b25') + ';' +
							'border-color: ' + (layerConfig.markerStyle.strokeColor || '#333') + ';' +
							'border-width: ' + (layerConfig.markerStyle.strokeWeight + 'px' || '1px') + ';' +
							'border-style: ' + (layerConfig.markerStyle.strokeColor || layerConfig.markerStyle.strokeWeight ? 'solid' : 'none') + ';' +
							'">' +
							(layerConfig.labelField ? '<div class="marker-label" style="top: ' + (layerConfig.markerStyle.radius * 2 || 20) + 'px">' + geoJsonPoint.properties[layerConfig.labelField] + '</div>' : '') +
							'</div>'
					}
					);

					return L.marker(latlng, {
						icon: divIcon,
						iconAnchor: [layerConfig.markerStyle.radius || 10, layerConfig.markerStyle.radius || 10]
					});
				}
				else {
					return L.marker(latlng);
				}
			}
		};

		// Om filter function finns som argument lägger vi den till options för L.geoJSON
		if (filter) {
			options.filter = filter;
		}

		var layer = L.geoJSON(data, options);

		if (layerConfig.clustered) {
			var clusterGroup = new L.MarkerClusterGroup({
				showCoverageOnHover: false,
				maxClusterRadius: 40,
				iconCreateFunction: function (cluster) {
					var childCount = cluster.getChildCount();
					var c = ' marker-cluster-';
					if (childCount < 10) {
						c += 'small';
					} else if (childCount < 20) {
						c += 'medium';
					} else {
						c += 'large';
					}

					var divBackgroundStyle = '';

					if (layerConfig.markerStyle && layerConfig.markerStyle.fillColor) {
						divBackgroundStyle = 'style="background-color: ' + layerConfig.markerStyle.fillColor + '"'
					}

					return new L.DivIcon({
						html: '<div ' + divBackgroundStyle + '><span>' +
							'<b>' + childCount + '</b>' +
							'</span></div>',
						className: 'marker-cluster' + c,
						iconSize: new L.Point(28, 28)
					});
				}
			});

			// Lägger geoJson layer till clusterGroup
			clusterGroup.addLayer(layer);

			// Lägger clusterGroup till kartan
			this.addLayer(clusterGroup, layerConfig);

			this.leafletLayers[layerConfig.layerId] = clusterGroup;
		}
		else {
			if (layerConfig.popupTemplate) {
				layer.bindPopup(function (marker) {
					var template = _.template(layerConfig.popupTemplate);
					return template(marker.feature.properties);
				});
			}

			//Example https://stackoverflow.com/questions/34858377/leaflet-how-to-style-polygons-from-geojson-data
			//http://jsfiddle.net/hx5pxdt8/
			//L.geoJson(myData, {style: areaStyle}).addTo(map);			

			// Lägger layer direkt till kartan, utan klustrering
			this.addLayer(layer, layerConfig);

			this.leafletLayers[layerConfig.layerId] = layer;
		}
	}

	addVectorGrid(layerConfig) {
		var layerStyles = {};

		if (layerConfig.layers) {
			_.each(layerConfig.layers, function (vectorLayer) {
				layerStyles[vectorLayer.name] = vectorLayer.style;
			});
		}

		var layer = L.vectorGrid.protobuf(layerConfig.url, {
			interactive: true,
			vectorTileLayerStyles: layerStyles
		});

		// används den här: 'layerConfig.popupTemplate'?
		if (layerConfig.popupTemplate) {
			layer.on('click', function (event) {
				var template = _.template(layerConfig.popupTemplate);

				L.popup()
					.setContent(template(event.layer.properties))
					.setLatLng(event.latlng)
					.openOn(this.map);
			}.bind(this));
		}

		this.addLayer(layer, layerConfig);

		this.leafletLayers[layerConfig.layerId] = layer;
		//		layer.bringToFront();
	}

	addWMSLayer(layerConfig) {
		var layer = L.tileLayer.wms(layerConfig.url, {
			layers: layerConfig.layers,
			format: 'image/png',
			transparent: true,
			hidden: layerConfig.hidden,
			TILED: layerConfig.TILED,
			ISBASELAYER: layerConfig.ISBASELAYER,
			TILESORIGIN: layerConfig.TILESORIGIN,
		});

		this.addLayer(layer, layerConfig);

		this.leafletLayers[layerConfig.layerId] = layer;
	}

	render() {
		var title = 'Hjälp';
		var overlayContent = '';
		var mainpart = '';
		if (!!this.state.config) {
			if (!!this.state.config.helpPopup) {
				if (this.state.config.helpText) {
					overlayContent = this.state.config.helpText;
				}
			} else {
				// add rule to hide the help button
				var style = document.createElement('style');
				style.innerHTML = `
				.help-button {
					display: none !important;
				}`;
				document.head.appendChild(style);
			}
			if (!!this.state.config.helpTitle) {
				title = this.state.config.helpTitle;
			}
			if (this.state.config.mainpart) {
				mainpart = <option value="mainpart">Huvudled</option>
			}
			if (this.state.config.hideLeafletControlLayers) {
				// add css rule to <head> to hide leaflet layer control
				var style = document.createElement('style');
				style.innerHTML = `
				.leaflet-control-layers {
					display: none !important;
				}`;
				document.head.appendChild(style);
			}
			if (this.state.config.hideIsofLogo) {
				// add css rule to <head> to hide isof logo
				var style = document.createElement('style');
				style.innerHTML = `
				.isof-logo {
					display: none !important;
				}`;
				document.head.appendChild(style);
			}
		}

		return (

			<div className="map-ui">

				<div className="isof-app">
				<a className="isof-logo" href="https://www.isof.se"><img src="img/isof_logotyp.svg" /></a>
					<div className="map-title">
					{
						this.state.config && this.state.config.mapTitle &&
						<div>{this.state.config.mapTitle}</div>
					}
					</div>
				</div>

				{
					this.state.searchBoxVisible &&
					<div className="search-box">
						<input id="search-field" placeholder="Sök" type="text" onChange={this.searchBoxChangeHandler} />
					</div>
				}
				{
					this.state.searchTextSelectVisible &&
					<div className="search-text-select">
						<select id="selected" onChange={this.searchTextSelectChangeHandler}>
							<option value="contains">Innehåller</option>
							<option value="startswith">Börjar med</option>
							<option value="endswith">Slutar med</option>
						</select>
					</div>
				}
				{
					this.state.searchTextSelectExtendedVisible &&
					<div className="search-text-select">
						<select id="selected" onChange={this.searchTextSelectChangeHandler}>
							<option value="contains">Innehåller</option>
							<option value="startswith">Börjar med</option>
							<option value="endswith">Slutar med</option>
							{mainpart}
						</select>
					</div>
				}
				{
					<div className="search-hits">
						<p id="hits"></p>
					</div>
				}

				<MapBase
					layersControlStayOpen={false}
					layersControlPosition="bottomright"
					disableSwedenMap={false}
					ignoreOverlayLayers={true}
					minZoom="5"
					maxZoom="17"
					scrollWheelZoom={true}
					ref="map"
					className="map-wrapper full-fixed"
					zoomControlPosition="bottomright"
				/>

				<InformationButton title={title} type="Uppteckning" location="app" text={overlayContent}/>
				<InformationOverlay />

				{overlayContent}

			</div>
		);
	}
}