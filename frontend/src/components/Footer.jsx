import "./Footer.css";
import SocialLinks from "./SocialLinks";

const Footer = () => {
  return (
    <footer className="footer custom-footer">
      <div className="footer-inner">


        <div className="footer-cols">

            <div className="footer-col">
              <p className="footer-title">Redes</p>

              <div className="footer-socials">
                <SocialLinks color="#ffffff" size={18} />
              </div>
            </div>

            <div className="footer-col">
              <h3 className="footer-slogan-mini">Ven a visitarnos</h3>

              <p className="footer-text">
                Abierto todos los días para compartir brunch y buenos momentos.
              </p>
            </div>

            <div className="footer-col">
              <p className="footer-title">Horarios</p>

              <p className="footer-text">L – V: 8:00 – 18:00</p>
              <p className="footer-text">S – D: 9:00 – 17:00</p>
            </div>

          </div>

        <div className="footer-bottom">
          <p>© 2026 Brunch & Co.</p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;