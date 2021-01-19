require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/widgets/Expand",
    "esri/request",
    "esri/layers/FeatureLayer",
    "esri/layers/support/Field",
    "esri/Graphic",
    "esri/views/SceneView",

    "esri/widgets/BasemapGallery",
    "esri/widgets/LayerList",
    "esri/widgets/Editor",
    "esri/layers/GraphicsLayer",
    "esri/widgets/Sketch/SketchViewModel",

], function (
    esriConfig,
    Map,
    MapView,
    Expand,
    request,
    FeatureLayer,
    Field,
    Graphic,
    SceneView,
    BasemapGallery,
    LayerList,
    Editor,
    GraphicsLayer,
    SketchViewModel
) {
    var portalUrl = "https://www.arcgis.com";
    var layerNames= [];
          
        
    document
        .getElementById("uploadForm")
        .addEventListener("change", function (event) {
            var fileName = event.target.value.toLowerCase();

            if (fileName.indexOf(".zip") !== -1) {
                //is file a zip - if not notify user
                generateFeatureCollection(fileName);
            } else {
                document.getElementById("upload-status").innerHTML =
                    '<p style="color:red">Please upload zip shapefile</p>';
            }
        });

        const graphicsLayer = new GraphicsLayer({
            id: "tempGraphics"
          });

          const pointSymbol = {
            type: "point-3d", // autocasts as new PointSymbol3D()
            symbolLayers: [
              {
                type: "icon", // autocasts as new IconSymbol3DLayer()
                size: 16,
                resource: {
                    href:"https://static.arcgis.com/arcgis/styleItems/Icons/web/resource/Ferry.svg"
                },
                material: {
                  color: "orange"
                },
                outline: {
                  color: "white",
                  size: 1
                }
              }
            ]
          };
  

    map = new Map({
        basemap: "topo-vector",
        ground: "world-elevation",
        layers: [graphicsLayer]
    });
    
      

    var view = new SceneView({
        container: "viewDiv", // Reference to the scene div created in step 5
        map: map, // Reference to the map object created before the scene
        scale: 50000000, // Sets the initial scale to 1:50,000,000
        center: [-89.500000, 44.500000],
        popup: {
            defaultPopupTemplateEnabled: true
        } // Sets the center point of view with lon/lat
    });

    view.when(function () {
       

        
        var layerList = new LayerList({
          view: view,
          listItemCreatedFunction: function (event) {
            var item = event.item;
        
            if (item.title === "") {
              // open the list item in the LayerList
              item.title = layerNames[0];
           
            }
          }
          
        });
        var expandLayer = new Expand({
          expandIconClass: "esri-icon-layer-list",
          view: view,
          content: layerList
        })
        view.ui.add(expandLayer,"top-right");
        

          const sketchViewModel = new SketchViewModel({
          view,
          layer: graphicsLayer,
          pointSymbol,
        });

        setUpClickHandler();

        // Listen to create-complete event to add a newly created graphic to view
        sketchViewModel.on("create-complete", addGraphic);

        // Listen the sketchViewModel's update-complete and update-cancel events
        sketchViewModel.on("update-complete", updateGraphic);
        sketchViewModel.on("update-cancel", updateGraphic);

        // called when sketchViewModel's create-complete event is fired.
        function addGraphic(event) {
          // Create a new graphic and set its geometry to
          // `create-complete` event geometry.
          const graphic = new Graphic({
            geometry: event.geometry,
            symbol: sketchViewModel.graphic.symbol
          });
          graphicsLayer.add(graphic);
        }

        // Runs when sketchViewModel's update-complete or update-cancel
        // events are fired.
        function updateGraphic(event) {
          // Create a new graphic and set its geometry event.geometry
          var graphic = new Graphic({
            geometry: event.geometry,
            symbol: editGraphic.symbol
          });
          graphicsLayer.add(graphic);

          // set the editGraphic to null update is complete or cancelled.
          editGraphic = null;
        }

        // set up logic to handle geometry update and reflect the update on "graphicsLayer"
        function setUpClickHandler() {
          view.on("click", function (event) {
            view.hitTest(event).then(function (response) {
              var results = response.results;
              if (results.length > 0) {
                for (var i = 0; i < results.length; i++) {
                  // Check if we're already editing a graphic
                  if (!editGraphic && results[i].graphic.layer.id === "tempGraphics") {
                    // Save a reference to the graphic we intend to update
                    editGraphic = results[i].graphic;
    
                    // Remove the graphic from the GraphicsLayer
                    // Sketch will handle displaying the graphic while being updated
                    graphicsLayer.remove(editGraphic);
                    sketchViewModel.update(editGraphic);
                    break;
                  }
                }
              }
            });
          });
        }

        // activate the sketch to create a point
        var drawPointButton = document.getElementById("pointButton");
        drawPointButton.onclick = function () {
          // set the sketch to create a point geometry
          sketchViewModel.create("point");
          setActiveButton(this);
        };

     
        // reset button
        document.getElementById("resetBtn").onclick = function () {

          graphicsLayer.removeAll();
          setActiveButton();
        };

        function setActiveButton(selectedButton) {
          // focus the view to activate keyboard shortcuts for sketching
          view.focus();
          var elements = document.getElementsByClassName("active");
          for (var i = 0; i < elements.length; i++) {
            elements[i].classList.remove("active");
          }
          if (selectedButton) {
            selectedButton.classList.add("active");
          }
        }
       

    })
   
      

    var fileForm = document.getElementById("mainWindow");

    var expand = new Expand({
        expandIconClass: "esri-icon-upload",
        view: view,
        content: fileForm
    });
    var expandEditor = new Expand({
      expandIconClass: "esri-icon-edit",
      view: view,
      content: new Editor({
        view: view,
      })
    })
 
    view.ui.add(expand, "top-right");
    view.ui.add(expandEditor,"top-right");
    
   
    

    function generateFeatureCollection(fileName) {
        var name = fileName.split(".");
        // Chrome and IE add c:\fakepath to the value - we need to remove it
        name = name[0].replace("c:\\fakepath\\", "");
        layerNames.unshift(name);

        document.getElementById("upload-status").innerHTML =
            "<b>Uploading file Please wait</b>" + name;

        // define the input params for generate see the rest doc for details
        var params = {
            name: name,
            targetSR: view.spatialReference,
            maxRecordCount: 50000,
            enforceInputFileSizeLimit: true,
            enforceOutputJsonSizeLimit: true
        };

        // generalize features to 10 meters for better performance
        params.generalize = true;
        params.maxAllowableOffset = 10;
        params.reducePrecision = true;
        params.numberOfDigitsAfterDecimal = 0;

        var myContent = {
            filetype: "shapefile",
            publishParameters: JSON.stringify(params),
            f: "json"
        };

        // use the REST generate operation to generate a feature collection from the zipped shapefile
        request(portalUrl + "/sharing/rest/content/features/generate", {
            query: myContent,
            body: document.getElementById("uploadForm"),
            responseType: "json"
        })
            .then(function (response) {
                var layerName =
                    response.data.featureCollection.layers[0].layerDefinition.name;
                document.getElementById("upload-status").innerHTML =
                    "<b>Loaded: </b>" + layerName;
                addShapefileToMap(response.data.featureCollection);
            })
            .catch(errorHandler);
    }

    function errorHandler(error) {
    document.getElementById("inFile").value = "";
        document.getElementById("upload-status").innerHTML =
            "<p style='color:red;max-width: 500px;'>" + error.message + "</p>";
    }

    function addShapefileToMap(featureCollection) {
        // add the shapefile to the map and zoom to the feature collection extent
        // if you want to persist the feature collection when you reload browser, you could store the
        // collection in local storage by serializing the layer using featureLayer.toJson()
        // see the 'Feature Collection in Local Storage' sample for an example of how to work with local storage
        var sourceGraphics = [];

        var layers = featureCollection.layers.map(function (layer) {
            var graphics = layer.featureSet.features.map(function (feature) {
                return Graphic.fromJSON(feature);
            });
            sourceGraphics = sourceGraphics.concat(graphics);
            var featureLayer = new FeatureLayer({
                objectIdField: "FID",
                source: graphics,
                fields: layer.layerDefinition.fields.map(function (field) {
                    return Field.fromJSON(field);
                })
            });
            return featureLayer;
            // associate the feature with the popup on click to enable highlight and zoom to
        });
        map.addMany(layers);

   
        
        view.goTo(sourceGraphics).catch(function (error) {
            if (error.name != "AbortError") {
                console.error(error);
            }
        });

        document.getElementById("upload-status").innerHTML = "";
    }
});

