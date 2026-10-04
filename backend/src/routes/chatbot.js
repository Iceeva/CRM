const router = require("express").Router();
const ctrl = require("../controllers/chatbotController");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const schemas = require("../middlewares/schemas");
const { rateLimit } = require("../middlewares/rateLimit");

// 40 messages par minute et par utilisateur (protege aussi les credits IA)
const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: 40,
  keyGenerator: (req) => `chat:${req.headers.authorization || req.ip}`,
  message: "Vous envoyez trop de messages, patientez quelques secondes.",
});

router.post("/message", auth, chatLimiter, validate(schemas.chatMessage), ctrl.message);
router.get("/status", auth, ctrl.status);
router.get("/history", auth, ctrl.history);
router.delete("/history", auth, ctrl.clearHistory);
router.post("/analyze", auth, chatLimiter, validate(schemas.chatMessage), ctrl.analyze);

module.exports = router;
