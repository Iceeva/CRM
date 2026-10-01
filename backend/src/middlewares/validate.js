/**
 * middlewares/validate.js - Validation declarative du corps des requetes
 * ----------------------------------------------------------------------------
 * Usage :
 *   router.post("/", auth, validateBody(schemas.clientCreate), ctrl.create);
 *
 * Regle de champ : { required, type, max, min, values }
 *   type : "string" | "email" | "number" | "enum" | "date" | "boolean"
 *
 * Les chaines sont nettoyees (trim) directement dans req.body.
 * En cas d'erreur : 400 { error: "<premier message>", errors: [{ field, message }] }
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function checkField(name, value, rule) {
  const empty = value === undefined || value === null || value === "";
  if (empty) {
    return rule.required ? `${name} est requis` : null;
  }

  switch (rule.type) {
    case "email":
      if (typeof value !== "string" || !EMAIL_RE.test(value)) return `${name} doit etre une adresse email valide`;
      break;
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return `${name} doit etre un nombre`;
      if (rule.min !== undefined && n < rule.min) return `${name} doit etre superieur ou egal a ${rule.min}`;
      if (rule.max !== undefined && n > rule.max) return `${name} doit etre inferieur ou egal a ${rule.max}`;
      break;
    }
    case "enum":
      if (!rule.values.includes(value)) return `${name} doit etre l'une des valeurs : ${rule.values.join(", ")}`;
      break;
    case "date":
      if (Number.isNaN(new Date(value).getTime())) return `${name} doit etre une date valide`;
      break;
    case "boolean":
      if (typeof value !== "boolean") return `${name} doit etre un booleen`;
      break;
    default: // string
      if (typeof value !== "string") return `${name} doit etre une chaine de caracteres`;
  }

  if (typeof value === "string") {
    if (rule.max && value.length > rule.max) return `${name} ne doit pas depasser ${rule.max} caracteres`;
    if (rule.min && value.length < rule.min) return `${name} doit contenir au moins ${rule.min} caracteres`;
  }
  return null;
}

function validateBody(rules) {
  return (req, res, next) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const errors = [];

    for (const [name, rule] of Object.entries(rules)) {
      if (typeof body[name] === "string") body[name] = body[name].trim();
      const message = checkField(name, body[name], rule);
      if (message) errors.push({ field: name, message });
    }

    if (errors.length) {
      return res.status(400).json({ error: errors[0].message, errors });
    }
    req.body = body;
    next();
  };
}

module.exports = validateBody;
module.exports.validateBody = validateBody;
module.exports.EMAIL_RE = EMAIL_RE;
