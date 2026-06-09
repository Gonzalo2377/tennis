/* ============================================================
   ACEVALUE — apellido canónico (nombres conflictivos de tenis)
   ------------------------------------------------------------
   Resuelve dos problemas:
   1) Apellido COMPUESTO ("Bautista Agut", "Davidovich Fokina")
      → la última palabra sola falla.
   2) Orden invertido / inicial de pila ("R. Bautista Agut" vs
      "Roberto Bautista Agut") → distinto nombre de pila.
   Detectamos el apellido compuesto por sus palabras (en cualquier
   posición), así da igual el orden o la inicial.
   ============================================================ */
function norm(w){ return (w||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase(); }
function toks(name){ return (name||'').replace(/[.,;:]+/g,' ').trim().split(/\s+/).map(norm).filter(Boolean).filter(w=>!/^(jr|ii|iii)$/.test(w)); }
function sig(name){ return toks(name).sort().join('|'); }

/* apellidos COMPUESTOS conocidos (palabras normalizadas). Si TODAS sus palabras
   están en el nombre, ese es el apellido canónico (unidas). */
const COMPOUND = [
  ['bautista','agut'], ['davidovich','fokina'], ['auger','aliassime'],
  ['mpetshi','perricard'], ['van','de','zandschulp'], ['de','minaur'],
  ['carballes','baena'], ['ramos','vinolas'], ['martinez','portero'],
  ['bautista','agut'], ['cobello'], // placeholder safe
  ['haddad','maia'], ['jimenez','kasintseva'], ['kostyuk'],
  ['mensik'], ['etcheverry'], ['cerundolo'], ['burruchaga'],
  ['gomez','herrera'], ['olivieri'], ['baez'],
  ['dedura','palomero'], ['molcan'], ['safiullin'],
].filter(a=>a.length>=2);   // solo nos interesan los de 2+ palabras

/* nombres con DOBLE nombre de pila donde el apellido es una sola palabra,
   y puede venir invertido. firma (palabras ordenadas) → apellido. */
const SIG2SURNAME = {};
function add(full, surname){ SIG2SURNAME[sig(full)] = norm(surname); }
add('Juan Manuel Cerundolo','cerundolo');
add('Francisco Cerundolo','cerundolo');
add('Tomas Martin Etcheverry','etcheverry');
add('Thiago Agustin Tirante','tirante');
add('Roman Andres Burruchaga','burruchaga');
add('Adolfo Daniel Vallejo','vallejo');
add('Camilo Ugo Carabelli','carabelli');
add('Maria Lourdes Carle','carle');
add('Maria Camila Osorio','osorio');
add('Elisabetta Cocciaretto','cocciaretto');

/* apellido canónico de un nombre completo (cualquier orden / con inicial) */
function canonSurname(name){
  const t = toks(name);
  if (!t.length) return '';
  const set = new Set(t);
  // 1) ¿coincide algún apellido compuesto? (todas sus palabras presentes)
  for (const c of COMPOUND){
    if (c.length>=2 && c.every(w=>set.has(w))) return c.join('');
  }
  // 2) ¿doble nombre de pila conocido? (por firma)
  const s = sig(name);
  if (SIG2SURNAME[s]) return SIG2SURNAME[s];
  // 3) por defecto: última palabra que no sea una inicial suelta
  const real = t.filter(w=>w.length>1);
  return (real[real.length-1] || t[t.length-1]);
}

module.exports = { canonSurname, sig };
