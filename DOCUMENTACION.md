# Geoportal · Gestión Catastral y Redes

**URL:** https://cargui97.github.io/GEOPORTAL_CARGUI/

---

## Arquitectura

### Repositorio
- **GitHub:** `CarGui97/GEOPORTAL_CARGUI`
- **Rama:** `main`
- **GitHub Pages:** activado desde `main` raíz

### Estructura de archivos
| Archivo | Descripción |
|---------|-------------|
| `index.html` | Geoportal completo (CSS + HTML + JS inline, ~1534 líneas) |
| `GEOPORTAL_AGUA_POTABLE/GEOPORTAL_CAPAS_HTML.html` | Copia fuente del mismo archivo |

> El proyecto actualmente es **monolito** (todo en un HTML). Pendiente separar CSS/JS en archivos externos.

---

## Dependencias (CDN)
| Librería | Versión | Propósito |
|----------|---------|-----------|
| Leaflet | 1.9.4 | Mapa base, capas GeoJSON, controles |
| Supabase JS | v2 | Conexión REST a Supabase/PostGIS |
| html2canvas | 1.4.1 | Exportar mapa a PNG e impresión |
| Google Fonts (Space Grotesk, Inter, JetBrains Mono) | — | Tipografía del dashboard |

---

## Conexión a Supabase

### Credenciales (embebidas en el JS)
- **URL:** `https://ngyhbdmsetntijitxjxo.supabase.co`
- **Key:** anon public (RLS solo lectura)
- **Modo:** cliente REST con `persistSession: false`

### Tablas (6)
| Tabla | Geometría | Descripción |
|-------|-----------|-------------|
| `agua_potable_wgs84` | `MultiLineString` (SRID 4326) | Red de agua potable |
| `catastro_rural_wgs84` | `MultiPolygon` (SRID 4326) | Predios catastrales rurales |
| `energia_electrica_wgs84` | `MultiLineString` (SRID 4326) | Red eléctrica |
| `recoleccion_basura_wgs84` | `MultiLineString` (SRID 4326) | Rutas de recolección |
| `red_alcantarillado_wgs84` | `MultiLineString` (SRID 4326) | Red de alcantarillado |
| `red_vial_cantonal_wgs84` | `MultiLineString` (SRID 4326) | Red vial cantonal |

Todas con columna `geom` en WKB hex. El JS decodifica WKB → GeoJSON en cliente.

---

## Funcionalidades implementadas

### 1. Mapa base
- Tres fondos: **Oscuro** (CartoDB dark), **Claro** (CartoDB voyager), **Satélite** (ArcGIS)
- Control de escala (métrico)
- Grilla de fondo oscura estilo dashboard

### 2. Selector de formato de coordenadas
- **Pestañas** UTM / Geográficas en la barra lateral
- UTM: muestra X, Y, Zona (ej: `600000, 9760000, 17S`)
- Geográficas: muestra Lat, Lng (ej: `-1.50000, -79.50000`)
- Las etiquetas cambian dinámicamente según el modo

### 3. Coordenadas en vivo
- Al mover el mouse sobre el mapa se actualizan en la barra lateral
- Al hacer clic en el display se copia al portapapeles

### 4. Búsqueda por coordenadas UTM
- Input para ingresar `X, Y`
- Botón **Ir** (o Enter) → centra el mapa y coloca marcador
- Detecta zona 17S/18S automáticamente

### 5. Marcador temporal (clic derecho)
- Coloca un círculo amarillo en el mapa
- Muestra popup con UTM y coordenadas geográficas
- Máximo 10 marcadores (los más viejos se eliminan)

### 6. Consulta espacial (clic izquierdo)
- Al hacer clic en un feature (punto, línea o polígono) muestra:
  - Nombre de la capa
  - Primer atributo disponible
- Hasta 15 features listados en el popup

### 7. Control de capas
- Checkbox para mostrar/ocultar cada capa
- Botón **Todo / nada**
- Botón **Recargar** (vuelve a leer de Supabase)
- Indicador de estado por capa (en espera / cargando / ok / error / sin geometría)

### 8. Zoom a capa
- Botón `◎` junto al nombre de cada capa → ajusta la vista al extent de esa capa

### 9. Opacidad por capa
- Slider individual para cada capa (0.00 a 1.00)
- Afecta tanto opacidad de línea como de relleno

### 10. Estadísticas catastrales
- Se calculan al cargar los datos:
  - **Redes:** kilómetros totales por tipo (agua, alcantarillado, energía, basura, vial)
  - **Catastro:** hectáreas totales y número de predios
- Targeta resumen con totales

### 11. Tabla de datos
- Selector de capa para ver los registros
- Columnas dinámicas según atributos de cada tabla
- Filtro por texto en todos los campos
- Contador de filas visibles / totales
- Colapsable (minimizar)

### 12. Estilo por atributo
- Seleccionar capa y campo
- Aplica colores categóricos (máximo 10 colores)
- Botón **Restaurar estilo original**

### 13. Medición de distancia
- Botón 📏 activa modo medición
- Clic en el mapa para agregar puntos
- Muestra distancia total en km
- Botón 🗑 limpia la medición

### 14. Exportar GeoJSON
- Descarga todas las features visibles como archivo `.geojson`

### 15. Exportar PNG
- Captura del mapa con `html2canvas`
- Descarga como `.png`

### 16. Imprimir vista
- Botón **Imprimir vista + atributos**
- Genera una nueva ventana con:
  - Imagen del mapa actual
  - Leyenda de capas visibles
  - Centro, esquinas (UTM), zoom, total features
  - Tabla de features visibles (capa, ubicación UTM, atributos)
  - Se imprime automáticamente en A4 horizontal

---

## Conversión de coordenadas
Implementación manual (sin proj4js):

- **latLngToUTM:** Transverse Mercator WGS84 → Easting, Northing, Zona
- **utmToLatLng:** Inversa
- Precisión: ±1 metro en easting/northing

## Decodificación WKB
Parser manual de WKB hex a GeoJSON:
- Soporta Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon
- Little-endian y big-endian
- SRID opcional (bit 0x20000000)

---

## Comandos git útiles

```bash
# Clonar
git clone https://github.com/CarGui97/GEOPORTAL_CARGUI.git

# Subir cambios
git add -A
git commit -m "mensaje"
git push origin main

# Ver estado
git status
git log --oneline
```

---

## Historial de desarrollo
1. HTML inicial con CDN Leaflet + Supabase
2. 6 capas desde Supabase con parseo WKB → GeoJSON
3. Coordenadas UTM en vivo + selector de formato
4. Búsqueda UTM, marcadores, consulta espacial
5. Panel de datos con filtro
6. Estadísticas (km, ha) con Haversine y área esférica
7. Exportar GeoJSON
8. Exportar PNG con html2canvas
9. Impresión con leyenda + atributos
10. Estilo por atributo, opacidad por capa

---

## Pendientes / ideas futuras
- Separar CSS y JS en archivos externos
- Agregar capa WMTS desde servidor local
- Desplegar en Vercel o Netlify como alternativa
- Cache de datos en localStorage
- Edición en vivo con RLS autenticado
