/* ============================================================
   MUNDIAL VALUE — configuración del sitio
   ------------------------------------------------------------
   👉 ESTO ES LO ÚNICO QUE TIENES QUE EDITAR TÚ.
   Pega aquí tus enlaces de pago de Stripe (Payment Links).
   NO pongas aquí la clave de The Odds API: esa va SOLO en el
   robot/servidor (si la pones aquí, se vería en el navegador).
   ============================================================ */
window.MV_CONFIG = {

    /* Marca del sitio (cámbiala aquí en un segundo).
       La web ya no es solo del Mundial: cubre ligas + selecciones. */
    brand: {
        name: 'GOL',          // primera parte del logo
        accent: 'VALUE',      // segunda parte (en color)
        tagline: 'VALOR · FÚTBOL',
    },

    /* Enlaces de pago de Stripe (Payment Links).
       Créalos en https://dashboard.stripe.com/payment-links
       · single = pago único 3,99 € (combinada del día)
       · all    = suscripción 14,99 €/mes (todas las combinadas)
       En cada Payment Link, configura la URL de redirección tras el pago a:
         https://TU-DOMINIO/?unlocked=single   (para el de 3,99 €)
         https://TU-DOMINIO/?unlocked=all       (para el de 14,99 €)
       Mientras estén sin rellenar, los botones desbloquean en modo demo. */
    stripe: {
        single: 'PASTE_STRIPE_PAYMENT_LINK_3.99',
        all:    'PASTE_STRIPE_PAYMENT_LINK_14.99',
    },

    /* De dónde lee la web los datos del día (lo genera el robot).
       La web NUNCA llama a The Odds API: solo lee este archivo. */
    dataUrl: 'daily.json',

    /* Horas que la web cachea los datos en el navegador (0 llamadas extra). */
    cacheHours: 12,

    /* Idioma por defecto */
    defaultLang: 'es',

    /* MODO DUEÑO — para verte TÚ todas las combinadas premium sin pagar.
       Entra en tu web con:  https://golvalue.online/?dueno=golvalue2026
       y se desbloquea todo SOLO en tu navegador (queda guardado para siempre).
       Para salir del modo dueño:  https://golvalue.online/?dueno=salir
       👉 CAMBIA esta clave por una tuya y vuelve a subir config.js. */
    ownerKey: 'golvalue2026',
};
