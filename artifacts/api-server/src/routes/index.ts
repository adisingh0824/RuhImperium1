import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ruhImperiumRouter from "./ruh-imperium";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ruhImperiumRouter);

export default router;
