/* ============================================================
   ACEVALUE — apellido canónico (nombres conflictivos de tenis)
   ------------------------------------------------------------
   Jugadores con doble nombre de pila o apellido compuesto donde
   "última palabra = apellido" falla. Se identifica por la FIRMA
   = palabras normalizadas y ordenadas alfabéticamente → así da
   igual el orden en que venga el nombre (OddsPapi vs SofaScore).
   ============================================================ */
function norm(w){ return (w||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase(); }
function sig(name){ return (name||'').replace(/[.,;:]+/g,' ').trim().split(/\s+/).map(norm).filter(Boolean).sort().join('|'); }

/* firma (palabras ordenadas) → apellido canónico */
const CANON = {};
function add(full, surname){ CANON[sig(full)] = norm(surname); }
// ---- ATP (doble nombre o apellido compuesto) ----
add('Juan Manuel Cerundolo','cerundolo');
add('Tomas Martin Etcheverry','etcheverry');
add('Thiago Agustin Tirante','tirante');
add('Roman Andres Burruchaga','burruchaga');
add('Adolfo Daniel Vallejo','vallejo');
add('Camilo Ugo Carabelli','carabelli');
add('Alejandro Davidovich Fokina','fokina');
add('Giovanni Mpetshi Perricard','perricard');
add('Botic Van de Zandschulp','zandschulp');
add('Pierre Hugues Herbert','herbert');
add('Jan Lennard Struff','struff');
add('Felix Auger Aliassime','aliassime');
add('Alex de Minaur','minaur');
add('Martin Damm Jr','damm');
// ---- WTA ----
add('Maria Lourdes Carle','carle');
add('Victoria Jimenez Kasintseva','kasintseva');
add('Maria Camila Osorio','osorio');
add('Beatriz Haddad Maia','haddad');
add('Elisabetta Cocciaretto','cocciaretto');

/* apellido canónico de un nombre completo (en cualquier orden) */
function canonSurname(name){
  const s = sig(name);
  if (CANON[s]) return CANON[s];
  // por defecto: última palabra (quita sufijos jr/ii)
  const parts = (name||'').replace(/[.,;:]+/g,' ').trim().split(/\s+/).map(norm).filter(Boolean).filter(w=>!/^(jr|ii|iii)$/.test(w));
  return parts[parts.length-1] || '';
}

module.exports = { canonSurname, sig };
