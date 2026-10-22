import { useEffect, useState } from "react";

function App() {

    const [productos, setProductos] = useState([]);

    useEffect(() => {

        fetch("http://localhost:3000/api/productos")
            .then(response => response.json())
            .then(data => {
                setProductos(data);
            })
            .catch(error => {
                console.error("Error:", error);
            });

    }, []);

    return (
        <div>
            <h1>Brunch</h1>

            {productos.map(producto => (
                <div key={producto.id}>
                    <h2>{producto.nombre}</h2>
                    <p>${producto.precio}</p>
                </div>
            ))}
        </div>
    );
}

export default App;