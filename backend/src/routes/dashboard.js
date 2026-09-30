const router = require("express").Router();
const ctrl = require("../controllers/dashboardController");
const auth = require("../middlewares/auth");

router.get("/stats", auth, ctrl.getStats);
router.get("/status", ctrl.getStatus); // pas d'auth (utilisé par le frontend au chargement)

module.exports = router;
