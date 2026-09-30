const router = require("express").Router();
const ctrl = require("../controllers/prospectsController");
const auth = require("../middlewares/auth");

router.get("/", auth, ctrl.getAll);
router.get("/:id", auth, ctrl.getById);
router.post("/", auth, ctrl.create);
router.put("/:id", auth, ctrl.update);
router.delete("/:id", auth, ctrl.remove);
router.post("/:id/convert", auth, ctrl.convert);

module.exports = router;
