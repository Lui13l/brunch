// Avisos sonoros. En un salón con ruido, el sonido llega antes que la pantalla,
// así que cada aviso suena distinto: no es lo mismo «entró un plato a cocina»
// que «la mesa 7 ya se puede llevar entera».
//
// Se sintetizan en el momento en vez de cargar archivos de audio: son dos tonos
// y así la app no depende de que un .mp3 esté servido ni cacheado.

function tono(ctx, frecuencia, inicio, duracion, volumen = 0.22) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = frecuencia;
  osc.type = "sine";
  gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
  gain.gain.linearRampToValueAtTime(volumen, ctx.currentTime + inicio + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + duracion);
  osc.start(ctx.currentTime + inicio);
  osc.stop(ctx.currentTime + inicio + duracion);
}

function reproducir(notas) {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    const ctx = new Audio();
    let fin = 0;
    for (const [frecuencia, inicio, duracion] of notas) {
      tono(ctx, frecuencia, inicio, duracion);
      fin = Math.max(fin, inicio + duracion);
    }
    setTimeout(() => ctx.close(), (fin + 0.2) * 1000);
  } catch {
    // Sin audio disponible: el aviso visual basta.
  }
}

// Cocina: una nota seca, para no cansar cuando entran platos sin parar.
export const sonarPlatoNuevo = () => reproducir([[880, 0, 0.4]]);

// Admin: pedido web nuevo. Dos notas que bajan, distinto de los del salón.
export const sonarPedidoWeb = () =>
  reproducir([
    [784, 0, 0.15],
    [523, 0.18, 0.4],
  ]);

// Mesero: dos notas que suben, porque esto es una buena noticia y además pide
// moverse. Se distingue del anterior incluso sin mirar.
export const sonarMesaLista = () =>
  reproducir([
    [660, 0, 0.18],
    [990, 0.16, 0.42],
  ]);
