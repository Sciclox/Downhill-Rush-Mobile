# 🚵 Downhill Rush - Extreme Mobile Bike Racing

Videojuego 3D de descenso extremo en bicicleta de montaña (*downhill*) para Android y navegadores móviles/escritorio, inspirado en clásicos arcade como *Downhill Domination* y *Lonely Mountains*.

---

## 🎮 Características del Juego

- **Física de Descenso 3D**:
  - Inercia por pendiente gravitacional, aceleración por pedaleo y derrape con freno.
  - Saltos en rampas (*kickers*) con control aéreo (flips y rotaciones para puntuación de trucos).
  - Suspensión elástica y detección de impacto/aterrizaje (aterrizaje perfecto da impulso; vuelco provoca wipeout y respawn en checkpoint).
- **Entorno de Montaña**:
  - Pista procedimental que desciende una cordillera alpina de más de 1.5 km de longitud.
  - Almohadillas de turbo Nitro (+velocidad inmediata).
  - Monedas/estrellas coleccionables a lo largo de las trazadas óptimas.
  - Vallas de madera, árboles y rocas montañosas.
  - Arco de salida y meta con explosión de confeti.
- **Efectos y Audio Procedural**:
  - Audio sintetizado en tiempo real con Web Audio API (ruido de viento dinámico según velocidad, cadenas, chirrido de derrape en tierra, salto e impacto).
  - Partículas de polvo y tierra levantadas por la rueda trasera.
  - Líneas de velocidad de túnel de viento al superar 60 km/h.
  - Cámara en 3ª persona con FOV dinámico (se amplía de 62° a 82° con la velocidad).
- **Controles Táctiles y Teclado**:
  - **Móvil**: Botones táctiles virtuales ergonómicos (`◀`, `▶`, `PEDAL`, `FRENO`).
  - **PC / Teclado**: Flechas / WASD para conducir, pedalear y frenar.

---

## 📱 Binario Android Compilado

El archivo `.apk` ya está generado y verificado con `aapt`:
- **Ruta del APK**: `Downhill-Rush-v1.0.0.apk`
- **Tamaño**: ~5.7 MB
- **Package**: `com.downhill.rush`
- **Compatibilidad**: Android 7.0+ (API 24 a 34+)

Para instalar directamente por ADB:
```powershell
adb install -r Downhill-Rush-v1.0.0.apk
```

---

## 🛠️ Ejecución y Desarrollo

### Servidor de Desarrollo Web (Vista previa instantánea):
```powershell
npm run dev
```

### Compilar cambios y actualizar APK:
```powershell
# 1. Compilar web
npm run build

# 2. Copiar a assets de Android
Copy-Item -Recurse -Force "dist\*" "android\app\src\main\assets\www\"

# 3. Compilar APK
cd android
.\gradlew assembleDebug
```
