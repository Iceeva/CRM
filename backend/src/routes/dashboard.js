const router = require("express").Router();
const ctrl = require("../controllers/dashboardController");
const auth = require("../middlewares/auth");

router.get("/stats", auth, ctrl.getStats);
router.get("/status", ctrl.getStatus); // public : utilise par le frontend au chargement

module.exports = router;
