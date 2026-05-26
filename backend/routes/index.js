import { Router } from "express";
import healthRouter from "./health.js";
import ruhImperiumRouter from "./ruh-imperium.js";

const router = Router();

router.use(healthRouter);
router.use(ruhImperiumRouter);

export default router;
