// Menú inicial que carga "npm run seed", tomado del diseño de Brunch & Co.
// Las categorías se muestran en este orden. Las imágenes están en
// frontend/public/menu, por eso img_url es una ruta del frontend.
module.exports = [
  {
    categoria: "Desayunos Clásicos",
    tipo: "plato",
    productos: [
      {
        nombre: "Pancakes",
        precio: 12900,
        img_url: "/menu/pancakes.jpg",
        descripcion: "Una torre de cuatro pancakes dorados y extra esponjosos, bañados con miel de abejas pura y azúcar glass. Coronados con frambuesas frescas, arándanos azules y láminas de almendra tostada.",
      },
      {
        nombre: "Bacon Eggs",
        precio: 18900,
        img_url: "/menu/baconeggs.webp",
        descripcion: "Tiras de tocineta premium ahumada en madera de nogal, cocinadas hasta el punto exacto de crocancia, acompañadas de un huevo frito con yema sedosa que resalta los sabores salados del conjunto.",
      },
      {
        nombre: "Muffin Inglés con Huevos",
        precio: 21000,
        img_url: "/menu/englisheggs.jpg",
        descripcion: "Muffin inglés artesanal tostado con huevos revueltos cremosos sazonados con pimienta negra molida. Acompañado de tomates cherry en rama asados para resaltar su dulzor natural.",
      },
      {
        nombre: "Huevos Revueltos Cremosos",
        precio: 15900,
        img_url: "/menu/eggs.jpg",
        descripcion: "Huevos revueltos de corral sazonados con pimienta negra molida y hierbas frescas. Acompañados de tostadas integrales caseras, aguacate fresco y tomates cherry maduros.",
      },
      {
        nombre: "Caldero Brunch&Co",
        precio: 14500,
        img_url: "/menu/calderito.jpg",
        descripcion: "Picadita de la casa con panceta ahumada, chorizo argentino, hongos frescos, coronado con espinaca verde y pan de ajo.",
      },
      {
        nombre: "Huevos Margarita",
        precio: 19000,
        img_url: "/menu/margaritatoast.jpg",
        descripcion: "Tostada de la casa coronada con huevo cocinado a baja temperatura, salsa de tomate casera con un toque de picante, queso mozzarella fundido y albahaca fresca. Un giro italiano para empezar tu día con sabor y estilo.",
      },
    ],
  },
  {
    categoria: "Brunch",
    tipo: "plato",
    productos: [
      {
        nombre: "Avocado Toast Campestre",
        precio: 30000,
        img_url: "/menu/avocado.jpg",
        descripcion: "Pan de masa madre tostado con crema de aguacate y salteado de vegetales frescos: maíz tierno, pimentón y cebollas caramelizadas. Terminado con romero fresco y pimienta negra recién molida.",
      },
      {
        nombre: "Eggs Benedict",
        precio: 29900,
        img_url: "/menu/eggs.jpg",
        descripcion: "Dos huevos pochados sobre muffins ingleses tostados y jamón de espalda premium. Bañados en salsa holandesa de la casa con páprika, acompañados de rúcula, tomates cherry y cebolla morada.",
      },
      {
        nombre: "Torrijas de Ricotta",
        precio: 26000,
        img_url: "/menu/torrejon.jpg",
        descripcion: "Rebanadas de brioche artesanal doradas en mantequilla, rellenas de crema de ricotta al limón y acompañadas de compota casera de arándanos frescos. Dulce, ácido y perfectamente equilibrado.",
      },
      {
        nombre: "Brunch de la casa",
        precio: 34900,
        img_url: "/menu/casa.jpg",
        descripcion: "Pan de masa madre tostado con crema de aguacate, salmón ahumado premium, cebolla morada encurtida y un huevo pochado. Acompañado con microgreens y semillas de sésamo.",
      },
      {
        nombre: "French Toast Gourmet",
        precio: 27500,
        img_url: "/menu/toastsweet.jpg",
        descripcion: "Rebanadas de pan brioche cubiertas con una mezcla de huevo y especias, cocinadas hasta dorar. Servidas con jarabe de arce puro, frutos rojos frescos y crema batida artesanal.",
      },
      {
        nombre: "Ensalada fit",
        precio: 32000,
        img_url: "/menu/ensalada.jpg",
        descripcion: "Versión premium de nuestro Eggs Benedict: dos huevos pochados, jamón ibérico, salsa holandesa casera con toque de trufa y espárragos frescos al vapor.",
      },
    ],
  },
  {
    categoria: "Bebidas",
    tipo: "bebida",
    productos: [
      {
        nombre: "Mimosa",
        precio: 16000,
        img_url: "/menu/mimosa_coctel.jpg",
        descripcion: "Burbujas de champaña encontrándose con el sol de un jugo de naranja recién exprimido. Fresca, festiva y elegante, la Mimosa es el brindis perfecto para empezar la mañana con estilo. Un clásico que nunca pasa de moda.",
      },
      {
        nombre: "Kombucha",
        precio: 10000,
        img_url: "/menu/kombucha.jpg",
        descripcion: "Una bebida fermentada de té con siglos de historia y personalidad propia. Ligeramente efervescente, con notas frutales y un toque ácido que despierta los sentidos. Cuida tu bienestar sin sacrificar el sabor — porque sentirse bien también puede ser delicioso.",
      },
      {
        nombre: "Matcha Latte",
        precio: 12000,
        img_url: "/menu/matcha_latte.jpg",
        descripcion: "Polvo de té verde japonés de primera calidad, suavemente disuelto en leche vaporizada hasta crear una bebida aterciopelada, cremosa y de un verde que enamora. Energía limpia y sostenida, sin los altibajos del café. La elección de quienes saben disfrutar despacio.",
      },
      {
        nombre: "Latte",
        precio: 16000,
        img_url: "/menu/latte.jpg",
        descripcion: "Bebida refrescante hecha con champagne premium y jugo de naranja recién exprimido. Perfecta para celebrar y disfrutar en cualquier momento del brunch.",
      },
      {
        nombre: "Smoothie",
        precio: 11000,
        img_url: "/menu/smoothie.jpg",
        descripcion: "Té matcha preparado en frío, suave y cremoso con un toque de hielo. Bebida refrescante que mantiene todos los beneficios del matcha con un sabor perfecto para días cálidos.",
      },
      {
        nombre: "Soda de Café",
        precio: 11500,
        img_url: "/menu/soda.jpg",
        descripcion: "Kombucha artesanal con sabores tropicales de mango y coco. Efervescente, refrescante y llena de probióticos naturales para tu bienestar.",
      },
    ],
  },
  {
    categoria: "Postres",
    tipo: "postre",
    productos: [
      {
        nombre: "French Toast",
        precio: 18900,
        img_url: "/menu/french_toast.jpg",
        descripcion: "Brioche tostado bañado en mezcla de huevo y especias, cocinado hasta dorar. Acompañado de sirope de arce, frutos silvestres frescos y crema batida casera.",
      },
      {
        nombre: "Parfait de granola y frutos rojos",
        precio: 14500,
        img_url: "/menu/parfait.jpg",
        descripcion: "Capas de yogur griego cremoso, granola casera crujiente, miel pura y frutos rojos frescos. Una combinación perfecta de texturas y sabores en cada cucharada.",
      },
      {
        nombre: "Açaí bowl",
        precio: 15000,
        img_url: "/menu/acai_bowl.jpg",
        descripcion: "Base de açaí puro congelado batido hasta crear una textura cremosa, coronada con granola artesanal, coco rallado, frutos frescos y miel de abejas.",
      },
      {
        nombre: "Cupcake Redvelvet",
        precio: 17500,
        img_url: "/menu/redvelvet.jpg",
        descripcion: "Waffle crujiente por fuera y suave por dentro, cubierto con chocolate derretido, frutos rojos frescos, crema batida y nueces caramelizadas.",
      },
      {
        nombre: "Ice cream",
        precio: 12900,
        img_url: "/menu/helado.jpg",
        descripcion: "Postre italiano tradicional con capas de bizcocho humedecido en café espresso, mascarpone cremoso y un toque de cacao en polvo. Elegancia en cada bocado.",
      },
      {
        nombre: "Macaroni",
        precio: 13500,
        img_url: "/menu/macaroni.jpg",
        descripcion: "Base de galleta casera crujiente, relleno de queso crema suave y ligero, coronado con compota casera de frutos rojos frescos. Perfecto final para tu brunch.",
      },
    ],
  },
];
