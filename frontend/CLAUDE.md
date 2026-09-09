# Frontend — règles locales

Les règles générales du dépôt sont dans `../CLAUDE.md`. Les conseils Next.js 16 propres à cette version sont dans `AGENTS.md` (généré par create-next-app).

@AGENTS.md

- Structure : `app/` (routes, App Router), `components/` (UI, dont `components/three/` pour la 3D), `lib/` (client API, session, hooks), `tests/msw/` (API simulée pour les tests).
- L'API est appelée en relatif sur `/api` avec `credentials: "include"`. En dev, `next.config.ts` relaie `/api` vers `API_URL` (par défaut `http://localhost:8000`). Ne jamais mettre d'URL de backend en dur dans le code.
- Aucune règle de jeu côté client : le serveur renvoie l'état complet après chaque coup. Les composants de plateau reçoivent l'état et émettent des intentions (`onTake`, `onPick`).
- Tests : `vitest` + Testing Library + MSW (`tests/msw/server.ts`). Tout appel réseau non simulé fait échouer le test (`onUnhandledRequest: "error"`). Les scènes WebGL ne sont pas testées dans jsdom ; elles sont couvertes par les tests bout en bout.
- Commandes : `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run build`, `npm run format`.
- Texte de l'interface en français, code et identifiants en anglais.
