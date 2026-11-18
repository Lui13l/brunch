// Caché en memoria para las APIs externas (clima, festivos, mapas). Sirve
// porque el backend corre en una sola instancia; con varias, cada una tendría
// la suya y solo se pediría unas veces de más.
const guardados = new Map();
// Pedidos en curso: si llegan diez visitas a la vez, se hace una sola llamada.
const enCurso = new Map();

/**
 * Devuelve lo guardado bajo `clave` si no ha vencido; si no, llama a `fn`,
 * guarda su resultado `ttlMs` milisegundos y lo devuelve.
 * Si `fn` falla no se guarda nada: el próximo pedido vuelve a intentarlo.
 */
const conCache = async (clave, ttlMs, fn) => {
  const guardado = guardados.get(clave);
  if (guardado && guardado.vence > Date.now()) return guardado.valor;
  if (enCurso.has(clave)) return enCurso.get(clave);

  const promesa = (async () => {
    try {
      const valor = await fn();
      guardados.set(clave, { valor, vence: Date.now() + ttlMs });
      return valor;
    } finally {
      enCurso.delete(clave);
    }
  })();
  enCurso.set(clave, promesa);
  return promesa;
};

// Para las pruebas: cada una empieza sin nada guardado.
const vaciarCache = () => {
  guardados.clear();
  enCurso.clear();
};

module.exports = { conCache, vaciarCache };
