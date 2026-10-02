const router = require("express").Router();
const ctrl = require("../controllers/interactionsController");
const auth = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const schemas = require("../middlewares/schemas");

router.get("/", auth, ctrl.getAll);
router.get("/:id", auth, ctrl.getById);
router.post("/", auth, validate(schemas.interactionCreate), ctrl.create);
router.put("/:id", auth, validate(schemas.interactionUpdate), ctrl.update);
router.delete("/:id", auth, ctrl.remove);

module.exports = router;
