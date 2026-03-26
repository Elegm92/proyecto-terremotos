//Configuración del proyecto firebase con mi config
const firebaseConfig = {
  apiKey: "AIzaSyBEAs1T0inzIB4aWDKtdR2oGOseq5TjDE0",
  authDomain: "fir-web-eb335.firebaseapp.com",
  projectId: "fir-web-eb335",
  storageBucket: "fir-web-eb335.firebasestorage.app",
  messagingSenderId: "115298909496",
  appId: "1:115298909496:web:c70439777529cfdaa9d5cd",
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Crear acceso a Firestore
const db = firebase.firestore();


// ==============================
// VARIABLES GLOBALES
// ==============================

// Crear mapa principal
const map = L.map("map").setView([20, 0], 2);

// Crear mapa filtrado
const filteredMap = L.map("filtered-map").setView([20, 0], 2);

// Capa donde se pintan los marcadores del mapa principal
let allMarkersLayer = L.layerGroup().addTo(map);

// Capa donde se pintan los marcadores del mapa filtrado
let filteredMarkersLayer = L.layerGroup().addTo(filteredMap);

// Variable para saber si el mapa filtrado está mostrando resultados
let isFiltered = false;

// Aquí guardamos los terremotos cargados desde la API general
let allEarthquakes = [];


// ==============================
// CONFIGURACIÓN DE LOS MAPAS
// ==============================

// Función para crear una capa base reutilizable
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

// Añadir la capa base a los dos mapas
createBaseLayer().addTo(map);
createBaseLayer().addTo(filteredMap);

// Al cargar la página, recalculamos el tamaño de los mapas
// para evitar que Leaflet los pinte mal
window.addEventListener("load", () => {
  map.invalidateSize();
  filteredMap.invalidateSize();
});


// ==============================
// PETICIÓN A LA API
// ==============================

// Esta función trae los terremotos del día desde la API de USGS
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
    alert("No se pudieron cargar los terremotos.");
    return null;
  }
}


// ==============================
// FUNCIONES AUXILIARES
// ==============================

// Según la magnitud, devolvemos un color distinto para el marcador
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

// Esta función crea el HTML del popup de cada terremoto
function createPopupContent(earthquake, isFavoriteView = false) {
  const properties = earthquake.properties;

  const title = properties.title || "Sin título";
  const place = properties.place || "Ubicación no disponible";
  const date = properties.time
    ? new Date(properties.time).toLocaleString("es-ES")
    : "Fecha no disponible";
  const magnitude = properties.mag ?? 0;
  const magType = properties.magType ?? "";
  const code = properties.code ?? "";

  // Saber si hay un usuario logueado
  const user = firebase.auth().currentUser;

  let buttonHtml = "";

  // Solo mostramos el botón de favoritos si:
  // - NO estamos en la vista favoritos
  // - SÍ hay usuario logueado
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

// Esta función crea el marcador circular en Leaflet
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
    fillOpacity: 0.8,
  }).bindPopup(createPopupContent(earthquake, isFavoriteView));
}


// ==============================
// DIBUJAR TERREMOTOS EN LOS MAPAS
// ==============================

// Pintar terremotos en el mapa principal
function drawAllEarthquakes(data, isFavoriteView = false) {
  // Borrar marcadores anteriores
  allMarkersLayer.clearLayers();

  // Si no hay datos, no hacemos nada
  if (!data.length) {
    return;
  }

  // Crear y añadir un marcador por cada terremoto
  data.forEach((earthquake) => {
    createMarker(earthquake, isFavoriteView).addTo(allMarkersLayer);
  });
}

// Pintar terremotos en el mapa filtrado
function drawFilteredEarthquakes(data) {
  // Borrar marcadores anteriores
  filteredMarkersLayer.clearLayers();

  // Si no hay resultados, avisamos
  if (!data.length) {
    alert("No se han encontrado terremotos con esos filtros.");
    return false;
  }

  // Guardamos coordenadas para ajustar el zoom después
  const bounds = [];

  data.forEach((earthquake) => {
    const marker = createMarker(earthquake);
    marker.addTo(filteredMarkersLayer);

    const coordinates = earthquake.geometry.coordinates;
    bounds.push([coordinates[1], coordinates[0]]);
  });

  // Ajustar el mapa a los puntos encontrados
  filteredMap.fitBounds(bounds, { padding: [20, 20] });

  return true;
}

// Limpiar el mapa filtrado y resetear el formulario
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


// ==============================
// FILTROS DEL SEGUNDO MAPA
// ==============================

// Escuchar el envío del formulario de filtros
document.getElementById("filter-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  // Si ya estaba filtrado, al pulsar limpiamos
  if (isFiltered) {
    clearFilteredMap();
    return;
  }

  // Leer valores del formulario
  const minMagnitude = document.getElementById("min-magnitude").value;
  const maxMagnitude = document.getElementById("max-magnitude").value;
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;

  // Validación de fechas
  if (startDate && endDate && startDate > endDate) {
    alert("La fecha de inicio no puede ser mayor que la fecha de fin.");
    return;
  }

  // Validación de magnitudes
  if (minMagnitude && maxMagnitude && Number(minMagnitude) > Number(maxMagnitude)) {
    alert("La magnitud mínima no puede ser mayor que la máxima.");
    return;
  }

  // Construir URL con filtros solo si existen valores
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson${
    minMagnitude ? `&minmagnitude=${minMagnitude}` : ""
  }${
    maxMagnitude ? `&maxmagnitude=${maxMagnitude}` : ""
  }${
    startDate ? `&starttime=${startDate}` : ""
  }${
    endDate ? `&endtime=${endDate}` : ""
  }`;

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
    alert("Error al cargar los datos filtrados.");
  }
});


// ==============================
// BOTONES DEL MAPA PRINCIPAL
// ==============================

// Mostrar terremotos de la API
document.getElementById("show-api").addEventListener("click", () => {
  drawAllEarthquakes(allEarthquakes);
});

// Mostrar favoritos del usuario
document.getElementById("show-favorites").addEventListener("click", showFavorites);


// ==============================
// FIREBASE AUTH - USUARIOS
// ==============================

// Guardar datos básicos del usuario en Firestore
function createUser(user) {
  return db.collection("users").doc(user.uid).set({
    uid: user.uid,
    email: user.email,
  });
}

// Registrar un nuevo usuario
async function signUpUser(email, password) {
  try {
    const userNew = await firebase
      .auth()
      .createUserWithEmailAndPassword(email, password);

    await createUser(userNew.user);

    alert("Usuario registrado correctamente");
    document.getElementById("register-form").reset();
  } catch (error) {
    console.error(error);
    alert("No se pudo registrar el usuario.");
  }
}

// Iniciar sesión
async function signInUser(email, password) {
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);

    alert("Inicio de sesión correcto");
    document.getElementById("login-form").reset();
  } catch (error) {
    console.error(error);
    alert("Email o contraseña incorrectos.");
  }
}

// Cerrar sesión
async function signOutUser() {
  try {
    await firebase.auth().signOut();
    alert("Sesión cerrada");
  } catch (error) {
    console.error(error);
    alert("Error al cerrar sesión.");
  }
}


// ==============================
// FORMULARIOS DE REGISTRO Y LOGIN
// ==============================

// Formulario de registro
document.getElementById("register-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;
  const repeatPassword = document.getElementById("register-password-repeat").value;

  // Comprobar que las contraseñas coinciden
  if (password !== repeatPassword) {
    alert("Las contraseñas no coinciden.");
    return;
  }

  signUpUser(email, password);
});

// Formulario de login
document.getElementById("login-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  signInUser(email, password);
});


// ==============================
// ESTADO DEL USUARIO LOGUEADO
// ==============================

// Esta función se ejecuta cada vez que cambia el usuario autenticado
firebase.auth().onAuthStateChanged((user) => {
  const userInfo = document.getElementById("user-info");

  if (user) {
    userInfo.innerHTML = `
      <h3>Estado</h3>
      <p>${user.email}</p>
      <button id="logout-btn">Cerrar sesión</button>
    `;

    document.getElementById("logout-btn").addEventListener("click", signOutUser);
  } else {
    userInfo.innerHTML = `
      <h3>Estado</h3>
      <p>No hay usuario conectado</p>
    `;
  }

  // Volver a pintar el mapa principal para que aparezca o desaparezca
  // el botón de "Añadir a favoritos" según si hay sesión o no
  drawAllEarthquakes(allEarthquakes);
});


// ==============================
// FAVORITOS EN FIRESTORE
// ==============================

// Guardar un terremoto como favorito del usuario logueado
async function addToFavorites(earthquake) {
  const user = firebase.auth().currentUser;

  // Si no hay usuario logueado, no dejamos guardar favoritos
  if (!user) {
    alert("Debes iniciar sesión para añadir favoritos.");
    return;
  }

  // Creamos un id único para evitar duplicados:
  // mismo usuario + mismo terremoto = mismo documento
  const docId = `${user.uid}_${earthquake.id}`;

  try {
    await db.collection("terremotos").doc(docId).set({
      userId: user.uid,
      userEmail: user.email,
      earthquakeId: earthquake.id,
      title: earthquake.properties.title,
      place: earthquake.properties.place,
      magnitude: earthquake.properties.mag ?? 0,
      magType: earthquake.properties.magType ?? "",
      code: earthquake.properties.code ?? "",
      time: earthquake.properties.time,
      coordinates: earthquake.geometry.coordinates,
    });

    alert("Terremoto añadido a favoritos.");
  } catch (error) {
    console.error("Error al añadir a favoritos:", error);
    alert("Error al guardar favorito.");
  }
}

// Buscar el terremoto en el array general y guardarlo como favorito
function addFavoriteFromPopup(earthquakeId) {
  const earthquake = allEarthquakes.find((eq) => eq.id === earthquakeId);

  if (!earthquake) {
    alert("No se ha encontrado el terremoto.");
    return;
  }

  addToFavorites(earthquake);
}

// Hacemos la función global para poder usarla desde el onclick del popup
window.addFavoriteFromPopup = addFavoriteFromPopup;

// Obtener favoritos del usuario actual desde Firestore
async function getFavorites() {
  const user = firebase.auth().currentUser;

  if (!user) {
    alert("Debes iniciar sesión.");
    return [];
  }

  try {
    const result = await db
      .collection("terremotos")
      .where("userId", "==", user.uid)
      .get();

    return result.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));
  } catch (error) {
    console.error("Error al obtener favoritos:", error);
    return [];
  }
}

// Mostrar los favoritos del usuario en el mapa principal
async function showFavorites() {
  const user = firebase.auth().currentUser;

  if (!user) {
    alert("Debes iniciar sesión para ver tus favoritos.");
    return;
  }

  try {
    const favorites = await getFavorites();

    const formattedFavorites = favorites.map((favorite) => ({
      id: favorite.data.earthquakeId,
      properties: {
        title: favorite.data.title,
        place: favorite.data.place,
        mag: favorite.data.magnitude,
        magType: favorite.data.magType || "",
        code: favorite.data.code || "",
        time: favorite.data.time,
      },
      geometry: {
        coordinates: favorite.data.coordinates,
      },
    }));

    drawAllEarthquakes(formattedFavorites, true);
  } catch (error) {
    console.error("Error al mostrar favoritos:", error);
    alert("No se pudieron cargar los favoritos.");
  }
}


// ==============================
// INICIO DE LA APP
// ==============================

// Función principal para cargar terremotos al abrir la página
async function init() {
  const data = await getEarthquakes();

  if (data && data.features) {
    allEarthquakes = data.features;
    drawAllEarthquakes(allEarthquakes);
  }
}

// Iniciar aplicación
init();