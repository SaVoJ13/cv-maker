// Konfiguracja aplikacji Android (Capacitor).
// UWAGA: appId nie da się zmienić po opublikowaniu aplikacji w Google Play.
const config = {
  appId: 'com.savoj13.freecv',
  appName: 'CV Maker',
  webDir: 'dist',
  plugins: {
    // Edge-to-edge (Android 15+, targetSdk 36): плагін SystemBars з Capacitor 8.
    // 'css': WebView 140+ віддає справжні env(safe-area-inset-*) (потрібен viewport-fit=cover в index.html);
    // старіші WebView отримують нативний відступ, а env(...) = 0. Додатково вставляє --safe-area-inset-*.
    SystemBars: {
      insetsHandling: 'css',
      // Підказка, що сторінка використовує viewport-fit=cover: без стрибка розкладки при старті.
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
