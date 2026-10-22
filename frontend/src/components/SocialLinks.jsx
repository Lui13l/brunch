const InstagramIcon = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="17.5" cy="6.5" r="0.8" fill={color} stroke="none" />
  </svg>
);

const FacebookIcon = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const TikTokIcon = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.78a4.85 4.85 0 0 1-1-.09z" />
  </svg>
);

const SocialLinks = ({ color = "#ffffff", size = 20, className = "" }) => (
  <div className={`social-icons ${className}`}>
    <a href="#" aria-label="Instagram" className="social-icon-link">
      <InstagramIcon size={size} color={color} />
    </a>
    <a href="#" aria-label="Facebook" className="social-icon-link">
      <FacebookIcon size={size} color={color} />
    </a>
    <a href="#" aria-label="TikTok" className="social-icon-link">
      <TikTokIcon size={size} color={color} />
    </a>
  </div>
);

export default SocialLinks;
