import { Router } from 'express';

const router = Router();

// No env values, versions or hostnames: this endpoint is public.
router.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
});

export default router;
