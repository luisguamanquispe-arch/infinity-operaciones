# App móvil LGB Técnicos (Android / iOS)

App nativa para técnicos de campo. Usa **Capacitor** y carga el módulo `/tecnico` del servidor en producción (GPS, cámara, firma y tickets).

## Opción rápida — PWA (sin Play Store)

1. En el celular abra: `https://infinity-operaciones-b3ij.onrender.com/login?app=tecnico`
2. **Android (Chrome):** Menú → *Instalar app* / *Agregar a pantalla de inicio*
3. **iPhone (Safari):** Compartir → *Agregar a pantalla de inicio*

Requiere HTTPS (Render ya lo tiene).

---

## App nativa con Capacitor

### Requisitos

| Plataforma | Herramientas |
|------------|--------------|
| **Android** | [Android Studio](https://developer.android.com/studio), JDK 17+ |
| **iOS** | Mac con [Xcode](https://developer.apple.com/xcode/) (solo macOS) |

### Arranque sin pantalla de Render

Por defecto la app muestra un **splash local** (`www/index.html` — Infinity Técnicos) y conecta al servidor en segundo plano. Así no aparece la página de “waking up” de Render al abrir la app.

1. Tras cambiar `.env`, ejecute:
   ```powershell
   npm run sync
   ```
2. Recompile el APK/IPA en Android Studio / Xcode.

**Desarrollo en vivo** (WebView apunta directo al servidor): en `.env` agregue `CAPACITOR_DIRECT_SERVER=true`.

### 1. Instalar dependencias

```powershell
cd mobile\tecnico
copy .env.example .env
npm install
```

Edite `.env` si usa otro dominio:

```
CAPACITOR_SERVER_URL=https://infinity-operaciones-b3ij.onrender.com
```

### 2. Generar iconos y splash

```powershell
npm run icons
npx cap sync
```

### 3. Android

```powershell
npm run add:android
npm run open:android
```

En Android Studio: **Build → Generate Signed Bundle / APK** para publicar en Play Store.

### 4. iOS (Mac)

```bash
npm run add:ios
npm run open:ios
```

En Xcode: seleccione su equipo de desarrollo y **Product → Archive** para App Store.

---

## Desarrollo local (emulador)

1. En la raíz del proyecto: `npm run dev`
2. En `mobile/tecnico/.env`:

```
CAPACITOR_SERVER_URL=http://10.0.2.2:3000
```

(`10.0.2.2` = localhost del PC visto desde el emulador Android)

3. `npm run sync` y `npm run run:android`

---

## Qué incluye la app

- Login solo técnicos (`?app=tecnico`)
- Agenda con fecha/hora programada
- Órdenes de trabajo, cronómetro, fotos, medición, firma
- GPS en mapa de trabajos
- Notificaciones WhatsApp al asignar ticket (servidor)

---

## Publicar en tiendas

### Google Play

1. Cuenta [Google Play Console](https://play.google.com/console) (~USD 25 único)
2. App firmada (AAB)
3. Política de privacidad (URL en su sitio web)
4. Capturas de pantalla del módulo técnico

### Apple App Store

1. Cuenta [Apple Developer](https://developer.apple.com) (~USD 99/año)
2. Build desde Xcode
3. Apple puede revisar que la app no sea solo un sitio web vacío; esta app usa GPS, cámara y firma nativa vía WebView

---

## Estructura

```
mobile/tecnico/
  capacitor.config.ts   # ID: ec.lgbsistemas.tecnico
  www/index.html        # Splash de carga
  resources/icon.png    # Icono 512×512
  android/              # Generado con cap add android
  ios/                  # Generado con cap add ios
```

## Cambiar URL de producción

Cuando active `ops.lgbsistemas.ec`, actualice:

- `mobile/tecnico/.env` → `CAPACITOR_SERVER_URL=https://ops.lgbsistemas.ec`
- `npm run sync` y vuelva a compilar la app
