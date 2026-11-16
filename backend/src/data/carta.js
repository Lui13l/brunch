// Vocabulario para que el chatbot entienda preguntas sobre la carta
// ("¿venden cerveza?", "¿cuánto cuesta el latte?"). Todo va en minúsculas, sin
// tildes y en singular, que es como el chatbot compara las palabras.

// Después de estas palabras viene lo que la persona busca.
// SEGURAS: solo se dicen de algo que se vende. Si no está en la carta, se
// responde que no se vende.
const PREGUNTAS_SEGURAS = [
  "venden", "vende", "sirven", "sirve", "preparan", "prepara", "ofrecen", "manejan",
  "cuanto cuesta", "cuanto cuestan", "cuanto vale", "cuanto valen",
  "precio de la", "precio del", "precio de", "valor de la", "valor del", "valor de",
];
// DUDOSAS: también se dicen de cosas que no son comida ("¿tienen parqueadero?",
// "quiero hablar con alguien"). Solo cuentan si lo buscado aparece en la carta
// o es una comida o bebida conocida (FAMILIAS).
const PREGUNTAS_DUDOSAS = ["tienen", "tiene", "hay", "quiero", "quisiera", "me das", "me regalas", "dame", "se me antoja"];

// Palabras que no dicen qué se busca.
const RELLENO = new Set([
  "un", "una", "uno", "unos", "unas", "el", "la", "lo", "los", "las", "de", "del", "al", "a", "en", "con", "sin", "y", "o", "que",
  "algo", "algun", "alguna", "alguno", "tipo", "clase", "por", "para", "favor", "porfa", "porfavor", "gracias", "hola", "buenas",
  "ustedes", "usted", "alla", "alli", "ahi", "aqui", "aca", "hoy", "ahora", "tambien", "me", "se", "te", "le", "les", "mi", "tu", "su",
  "mas", "muy", "es", "son", "esta", "estan", "si", "no", "como", "cual", "cuales", "cuanto", "cuesta", "vale", "precio", "valor",
  "carta", "menu", "local", "restaurante", "venta", "disponible",
]);

// Comidas y bebidas comunes y a qué `tipo` de plato pertenecen. Sirve para
// dos cosas: saber que "cerveza" es algo que se pide (aunque no esté en la
// carta) y ofrecer en su lugar lo que sí hay de ese tipo.
const FAMILIAS = {
  bebida: [
    "bebida", "cerveza", "gaseosa", "coca", "cola", "pepsi", "sprite", "jugo", "limonada", "agua", "vino", "coctel", "mojito",
    "michelada", "te", "tinto", "cafe", "capuchino", "cappuccino", "latte", "americano", "expreso", "espresso", "malteada",
    "batido", "smoothie", "chocolate", "aromatica", "soda", "refresco", "licor", "trago", "sangria", "mimosa", "kombucha",
    "milo", "avena", "champana", "whisky", "ron", "aguardiente", "leche", "frappe",
  ],
  postre: [
    "postre", "torta", "pastel", "helado", "brownie", "galleta", "cheesecake", "flan", "tiramisu", "dona", "cupcake", "dulce",
    "muffin", "gelatina", "obleas", "oblea", "churro", "crepe", "waffle",
  ],
  plato: [
    "hamburguesa", "pizza", "pasta", "sandwich", "arepa", "empanada", "sopa", "ensalada", "huevo", "pancake", "tostada",
    "omelet", "omelette", "pollo", "carne", "perro", "salchipapa", "arroz", "taco", "burrito", "wrap", "bowl", "tamal",
    "calentado", "almuerzo", "desayuno", "pescado", "lasana", "papa", "costilla", "chuleta", "bandeja", "sancocho", "ceviche",
    "sushi", "alita", "nugget", "quesadilla", "nacho", "pan", "tocino", "tocineta", "aguacate", "queso", "jamon",
  ],
};

// Cómo se nombra cada tipo al ofrecer alternativas ("En bebidas tenemos…").
const NOMBRE_FAMILIA = { bebida: "bebidas", postre: "postres", plato: "platos" };

// La carta mezcla español e inglés: quien pregunta por "huevos" también
// quiere ver los "Eggs Benedict".
const SINONIMOS = {
  huevo: ["egg"],
  tostada: ["toast"],
  helado: ["ice", "cream"],
  tocino: ["bacon"],
  tocineta: ["bacon"],
  aguacate: ["avocado"],
  cafe: ["latte"],
  capuchino: ["latte"],
  cappuccino: ["latte"],
  batido: ["smoothie"],
  malteada: ["smoothie"],
  pastel: ["cupcake"],
  torta: ["cupcake"],
  panqueque: ["pancake"],
  gaseosa: ["soda"],
  refresco: ["soda"],
};

module.exports = { PREGUNTAS_SEGURAS, PREGUNTAS_DUDOSAS, RELLENO, FAMILIAS, NOMBRE_FAMILIA, SINONIMOS };
