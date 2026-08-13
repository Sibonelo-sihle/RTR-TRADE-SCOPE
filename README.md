# RTR-TradeScope beta

RTR-TradeScope is a React/Vite trading journal backed by FastAPI, SQLAlchemy, and Supabase PostgreSQL.

## Beta data notice

This test deployment is a **shared workspace**. Authentication and per-user isolation are not implemented yet, so both testers can see, edit, and delete the same records. Do not enter sensitive or production trading data. Supabase Auth and mandatory `user_id` scoping are the next phase.

## Tester checklist

1. Open RTR-TradeScope.
2. Open Dashboard.
3. Create one BUY trade.
4. Refresh.
5. Confirm trade remains.
6. Edit trade.
7. Refresh.
8. Confirm edit remains.
9. Open Analytics.
10. Check updated metrics.
11. Create a Strategy.
12. Refresh.
13. Confirm strategy remains.
14. Create an Alert.
15. Refresh.
16. Confirm alert remains.
17. Use Journal filters.
18. Delete test trade.
19. Refresh.
20. Confirm deletion remains.
21. Test on mobile.
22. Report anything confusing or broken.

For feedback, copy this checklist into a message and include: what you tried, what worked, what failed, what was confusing, and one suggested improvement.

## Deployment configuration

Suggested slugs: `rtr-tradescope` for Vercel and `rtr-tradescope-api` for Render.

### Render backend

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/api/health`
- Secret environment variables: `DATABASE_URL`, `DIRECT_URL`, `FRONTEND_URL`

The schema is already at Alembic revision `0001_initial`; deployment does not automatically run migrations.

### Vercel frontend

- Root directory: `artifacts/rtr-tradescope`
- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm run build`
- Output directory: `dist/public`
- Environment: `VITE_DATA_PROVIDER=api`
- Environment: `VITE_API_BASE_URL=https://YOUR-RENDER-BACKEND.onrender.com`

Set backend `FRONTEND_URL` to the final Vercel origin. The frontend rewrite in `vercel.json` supports direct refreshes of all client-side routes.
