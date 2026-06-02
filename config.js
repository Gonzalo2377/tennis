/* ============================================================
   ACEVALUE — configuración del sitio (tenis)
   ------------------------------------------------------------
   La clave de The Odds API va SOLO en el robot/servidor
   (robot/fetch-daily.js usa la variable de entorno ODDS_API_KEY).
   Nunca la pongas aquí: este archivo se ve en el navegador.
   ============================================================ */
window.ACE_CONFIG = {
    /* De dónde lee la web los datos que genera el robot. */
    dataUrl: 'daily.json',

    /* Horas que la web cachea los datos en el navegador (0 llamadas a la API). */
    cacheHours: 12,

    /* Idioma por defecto: 'es' o 'en'. */
    defaultLang: 'es',

    /* Sin premium por ahora. Cuando quieras activarlo, pon true y añade los
       enlaces de pago (igual que en la web de fútbol). */
    premiumEnabled: false,
};

/* ============================================================
   FOTOS DE JUGADORES (opcional)
   ------------------------------------------------------------
   The Odds API no da fotos. Aquí puedes pegar la URL de la cara de
   cada jugador y aparecerá en su avatar (cabecera de partido,
   buscador, tarjetas). Si no pones foto, se muestra un monograma
   elegante con sus iniciales y bandera.

   La CLAVE es el "id" del jugador = su nombre en minúsculas, sin
   espacios ni acentos (máx. 16 letras). Ejemplos:
     'Carlos Alcaraz'  -> 'carlosalcaraz'
     'Iga Świątek'     -> 'igaswiatek'
   Usa fotos libres/propias (evita material con derechos).
   ============================================================ */
window.ACE_PHOTOS = {
    // carlosalcaraz: 'https://tu-dominio.com/fotos/alcaraz.jpg',
    // janniksinner:  'https://tu-dominio.com/fotos/sinner.jpg',
};

