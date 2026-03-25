// ===== MAPAS =====
const map = L.map("map").setView([20, 0], 2);
const filteredMap = L.map("filtered-map").setView([20, 0], 2);

// ===== CAPA BASE =====
function createBaseLayer() {
  return L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  );
}

createBaseLayer().addTo(map);
createBaseLayer().addTo(filteredMap);

// Ajustar el tamaño visual
window.addEventListener("load", () => {
  map.invalidateSize();
  filteredMap.invalidateSize();
});

// Capa para marcadores del mapa filtrado
let filteredMarkersLayer = L.layerGroup().addTo(filteredMap);

// ===== OBTENER TERREMOTOS GENERALES =====
async function getEarthquakes() {
  try {
    const response = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
    );

    if (!response.ok) {
      throw new Error("Error al obtener los datos de terremotos");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

// ===== COLORES SEGÚN MAGNITUD =====
function getColorByMagnitude(magnitude) {
  if (magnitude < 1) return "#22c55e";
  if (magnitude < 2) return "#84cc16";
  if (magnitude < 3) return "#eab308";
  if (magnitude < 4) return "#f59e0b";
  if (magnitude < 5) return "#f97316";
  if (magnitude < 6) return "#ef4444";
  if (magnitude < 7) return "#dc2626";
  return "#7f1d1d";
}

// ===== CONTENIDO DEL POPUP =====
function createPopupContent(earthquake) {
  const properties = earthquake.properties;

  const title = properties.title;
  const place = properties.place;
  const date = new Date(properties.time).toLocaleString("es-ES");
  const magnitude = properties.mag ?? 0;
  const magType = properties.magType;
  const code = properties.code;

  return `
    <article>
      <h3>${title}</h3>
      <p><strong>Fecha:</strong> ${date}</p>
      <p><strong>Ubicación:</strong> ${place}</p>
      <p><strong>Código:</strong> ${code}</p>
      <p><strong>Magnitud:</strong> ${magnitude} ${magType}</p>
    </article>
  `;
}

// ===== CREAR MARCADOR =====
function createMarker(earthquake) {
  const coordinates = earthquake.geometry.coordinates;
  const magnitude = earthquake.properties.mag ?? 0;

  const lng = coordinates[0];
  const lat = coordinates[1];

  return L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: getColorByMagnitude(magnitude),
    color: "#ffffff",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8,
  }).bindPopup(createPopupContent(earthquake));
}

// ===== DIBUJAR MAPA GENERAL =====
function drawAllEarthquakes(data) {
  data.forEach((earthquake) => {
    createMarker(earthquake).addTo(map);
  });
}

// ===== DIBUJAR MAPA FILTRADO =====
function drawFilteredEarthquakes(data) {
  filteredMarkersLayer.clearLayers();

  if (!data.length) {
    alert("No se han encontrado terremotos con esos filtros.");
    return;
  }

  const bounds = [];

  data.forEach((earthquake) => {
    const marker = createMarker(earthquake);
    marker.addTo(filteredMarkersLayer);

    const coordinates = earthquake.geometry.coordinates;
    bounds.push([coordinates[1], coordinates[0]]);
  });

  filteredMap.fitBounds(bounds, { padding: [20, 20] });
}

// ===== CARGA INICIAL =====
async function init() {
  const data = await getEarthquakes();

  if (data && data.features) {
    drawAllEarthquakes(data.features);
  }
}

// ===== FILTRO =====
document.getElementById("filter-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const minMagnitude = document.getElementById("min-magnitude").value;
  const maxMagnitude = document.getElementById("max-magnitude").value;
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;

  if (startDate && endDate && startDate > endDate) {
    alert("La fecha de inicio no puede ser mayor que la fecha de fin.");
    return;
  }

  if (
    minMagnitude &&
    maxMagnitude &&
    Number(minMagnitude) > Number(maxMagnitude)
  ) {
    alert("La magnitud mínima no puede ser mayor que la máxima.");
    return;
  }

  let url =
    "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson";

  if (minMagnitude) url += `&minmagnitude=${minMagnitude}`;
  if (maxMagnitude) url += `&maxmagnitude=${maxMagnitude}`;
  if (startDate) url += `&starttime=${startDate}`;
  if (endDate) url += `&endtime=${endDate}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Error al obtener los terremotos filtrados");
    }

    const data = await response.json();

    if (data && data.features) {
      drawFilteredEarthquakes(data.features);
    }
  } catch (error) {
    console.error("Error:", error);
  }
});

// ===== EJECUTAR =====
init();