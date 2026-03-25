// ======================
// FIREBASE
// ======================
const firebaseConfig = {
  apiKey: "AIzaSyBEAs1T0inzIB4aWDKtdR2oGOseq5TjDE0",
  authDomain: "fir-web-eb335.firebaseapp.com",
  projectId: "fir-web-eb335",
  storageBucket: "fir-web-eb335.firebasestorage.app",
  messagingSenderId: "115298909496",
  appId: "1:115298909496:web:c70439777529cfdaa9d5cd"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ======================
// MAPAS
// ======================
const map = L.map("map").setView([20, 0], 2);
const filteredMap = L.map("filtered-map").setView([20, 0], 2);

// Capas para marcadores
let allMarkersLayer = L.layerGroup().addTo(map);
let filteredMarkersLayer = L.layerGroup().addTo(filteredMap);

// Estado del botón de filtro
let isFiltered = false;

// Guardamos los terremotos cargados de la API general
let allEarthquakes = [];

// ======================
// CAPA BASE
// ======================
function createBaseLayer() {
  return L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }
  );
}

createBaseLayer().addTo(map);
createBaseLayer().addTo(filteredMap);

// Ajustar tamaño visual
window.addEventListener("load", () => {
  map.invalidateSize();
  filteredMap.invalidateSize();
});

// ======================
// API TERREMOTOS
// ======================
async function getEarthquakes() {
  try {
    const response = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
    );

    if (!response.ok) {
      throw new Error("Error al obtener los datos de terremotos");
    }

    return await response.json();
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

// ======================
// FAVORITOS EN FIRESTORE
// ======================
function addToFavorites(earthquake) {
  const user = firebase.auth().currentUser;

  if (!user) {
    alert("Debes iniciar sesión para añadir favoritos.");
    return;
  }

  const docId = `${user.uid}_${earthquake.id}`;

  db.collection("terremotos")
    .doc(docId)
    .set({
      userId: user.uid,
      userEmail: user.email,
      earthquakeId: earthquake.id,
      title: earthquake.properties.title,
      place: earthquake.properties.place,
      magnitude: earthquake.properties.mag ?? 0,
      time: earthquake.properties.time,
      coordinates: earthquake.geometry.coordinates
    })
    .then(() => {
      alert("Terremoto añadido a favoritos.");
    })
    .catch((error) => {
      console.error("Error al añadir a favoritos:", error);
    });
}

function addFavoriteFromPopup(earthquakeId) {
  const earthquake = allEarthquakes.find((eq) => eq.id === earthquakeId);

  if (!earthquake) {
    alert("No se ha encontrado el terremoto.");
    return;
  }

  addToFavorites(earthquake);
}

// Necesario para usarlo desde el onclick del popup
window.addFavoriteFromPopup = addFavoriteFromPopup;

// ======================
// ESTILOS DE TERREMOTOS
// ======================
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

// ======================
// POPUPS
// ======================
function createPopupContent(earthquake, isFavoriteView = false) {
  const properties = earthquake.properties;

  const title = properties.title;
  const place = properties.place;
  const date = new Date(properties.time).toLocaleString("es-ES");
  const magnitude = properties.mag ?? 0;
  const magType = properties.magType ?? "";
  const code = properties.code ?? "";

  const user = firebase.auth().currentUser;

  let buttonHtml = "";

  if (!isFavoriteView && user) {
    buttonHtml = `
      <button type="button" onclick="addFavoriteFromPopup('${earthquake.id}')">
        Añadir a favoritos
      </button>
    `;
  }

  return `
    <article>
      <h3>${title}</h3>
      <p><strong>Fecha:</strong> ${date}</p>
      <p><strong>Ubicación:</strong> ${place}</p>
      <p><strong>Código:</strong> ${code}</p>
      <p><strong>Magnitud:</strong> ${magnitude} ${magType}</p>
      ${buttonHtml}
    </article>
  `;
}

// ======================
// MARCADORES
// ======================
function createMarker(earthquake, isFavoriteView = false) {
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
    fillOpacity: 0.8
  }).bindPopup(createPopupContent(earthquake, isFavoriteView));
}

// ======================
// DIBUJAR MAPAS
// ======================
function drawAllEarthquakes(data) {
  allMarkersLayer.clearLayers();

  data.forEach((earthquake) => {
    createMarker(earthquake).addTo(allMarkersLayer);
  });
}

function drawFilteredEarthquakes(data) {
  filteredMarkersLayer.clearLayers();

  if (!data.length) {
    alert("No se han encontrado terremotos con esos filtros.");
    return false;
  }

  const bounds = [];

  data.forEach((earthquake) => {
    const marker = createMarker(earthquake);
    marker.addTo(filteredMarkersLayer);

    const coordinates = earthquake.geometry.coordinates;
    bounds.push([coordinates[1], coordinates[0]]);
  });

  filteredMap.fitBounds(bounds, { padding: [20, 20] });
  return true;
}

function redrawMap() {
  if (allEarthquakes.length) {
    drawAllEarthquakes(allEarthquakes);
  }
}

// ======================
// LIMPIAR FILTRO
// ======================
function clearFilteredMap() {
  document.getElementById("min-magnitude").value = "";
  document.getElementById("max-magnitude").value = "";
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";

  filteredMarkersLayer.clearLayers();
  filteredMap.setView([20, 0], 2);

  isFiltered = false;
  document.getElementById("filter-btn").textContent = "Filtrar";
}

// ======================
// CARGA INICIAL
// ======================
async function init() {
  const data = await getEarthquakes();

  if (data && data.features) {
    allEarthquakes = data.features;
    drawAllEarthquakes(data.features);
  }
}

// ======================
// FILTRO DEL SEGUNDO MAPA
// ======================
document.getElementById("filter-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isFiltered) {
    clearFilteredMap();
    return;
  }

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
      const hasResults = drawFilteredEarthquakes(data.features);

      if (hasResults) {
        isFiltered = true;
        document.getElementById("filter-btn").textContent = "Limpiar";
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
});

// ======================
// AUTH FIREBASE
// ======================
function createUserDocument(user) {
  const userRef = db.collection("users").doc(user.uid);

  return userRef.get().then((doc) => {
    if (!doc.exists) {
      return userRef.set({
        uid: user.uid,
        email: user.email
      });
    }
  });
}

async function signUpUser(email, password) {
  try {
    const userCredential = await firebase
      .auth()
      .createUserWithEmailAndPassword(email, password);

    await createUserDocument(userCredential.user);

    alert("Usuario registrado correctamente.");
  } catch (error) {
    console.error("Error en el registro:", error);
    alert(error.message);
  }
}

async function signInUser(email, password) {
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    alert("Sesión iniciada correctamente.");
  } catch (error) {
    console.error("Error en el login:", error);
    alert(error.message);
  }
}

async function signOutUser() {
  try {
    await firebase.auth().signOut();
    alert("Sesión cerrada.");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    alert(error.message);
  }
}

// ======================
// FORMULARIOS AUTH
// ======================
document.getElementById("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value.trim();

  if (!email || !password) {
    alert("Completa email y contraseña.");
    return;
  }

  await signUpUser(email, password);
  event.target.reset();
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    alert("Completa email y contraseña.");
    return;
  }

  await signInUser(email, password);
  event.target.reset();
});

// ======================
// ESTADO DE SESIÓN
// ======================
firebase.auth().onAuthStateChanged((user) => {
  const userInfo = document.getElementById("user-info");

  if (user) {
    userInfo.innerHTML = `
      <h3>Estado</h3>
      <p>Conectado como: ${user.email}</p>
      <button id="logout-btn" type="button">Cerrar sesión</button>
    `;
  } else {
    userInfo.innerHTML = `
      <h3>Estado</h3>
      <p>No hay usuario conectado</p>
      <button id="logout-btn" type="button">Cerrar sesión</button>
    `;
  }

  document.getElementById("logout-btn").addEventListener("click", signOutUser);

  // Redibujar el mapa para actualizar los popups
  redrawMap();
});

// ======================
// EJECUTAR
// ======================
init();