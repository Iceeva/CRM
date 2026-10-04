/**
 * components/Icon.jsx - Icone Bootstrap Icons
 * ----------------------------------------------------------------------------
 * Les icones viennent du paquet npm `bootstrap-icons` (police d'icones importee
 * dans src/index.js), sans CDN : l'application fonctionne hors ligne et les
 * icones sont embarquees dans le build.
 *
 * Usage : <Icon name="people" />  ->  <i class="bi bi-people"></i>
 * Catalogue complet : https://icons.getbootstrap.com
 */
export default function Icon({ name, className = "", title, ...rest }) {
  return (
    <i
      className={`bi bi-${name} ${className}`.trim()}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      {...rest}
    />
  );
}

/** Icone associee a chaque type d'interaction. */
export const INTERACTION_ICONS = {
  appel: "telephone",
  email: "envelope",
  reunion: "people",
  note: "journal-text",
};

/** Icone d'un type d'interaction (note par defaut). */
export function InteractionIcon({ type, className = "" }) {
  return <Icon name={INTERACTION_ICONS[type] || "journal-text"} className={className} />;
}
