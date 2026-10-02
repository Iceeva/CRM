const router = require("express").Router();
const ctrl = require("../controllers/authController");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const schemas = require("../middlewares/schemas");
const { rateLimit } = require("../middlewares/rateLimit");

// 10 tentatives / 15 min / IP sur les routes sensibles (anti force brute)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Trop de tentatives de connexion, reessayez dans 15 minutes.",
});

router.post("/register", authLimiter, validate(schemas.register), ctrl.register);
router.post("/login", authLimiter, validate(schemas.login), ctrl.login);
router.get("/me", auth, ctrl.getMe);

module.exports = router;
