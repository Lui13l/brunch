 import React from "react";
 import "../pages/ContactUs.css";
const Form = () => {
    return (
        <form>
            <label>
                Nombre
                <input type="text" name="name" placeholder="Tu nombre" />
            </label>
            <label>
                Email
                <input type="email" name="email" placeholder="tucorreo@ejemplo.com" />
            </label>
            <label>
                Opinión
                <textarea name="message" placeholder="Cuéntanos qué te gustaría..." />
            </label>
            <button type="submit">Enviar mensaje</button>
        </form>
    )
}

export default Form;