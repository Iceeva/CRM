# Prisma : schema, migrations, seed

| Fichier | Role |
|---|---|
| `schema.prisma` | 6 modeles (`User`, `Client`, `Prospect`, `Interaction`, `Opportunity`, `ChatMessage`), datasource Neon (`url` poolee + `directUrl`), cible binaire Vercel |
| `migrations/20260930000000_init/` | Migration initiale (tables, index, cles etrangeres) |
| `migrations/migration_lock.toml` | Verrou du fournisseur (`postgresql`) |
| `seed.js` | Insere `backend/data/data.json` dans la base, idempotent (`upsert`) |

## Commandes (depuis la racine du depot)

```bash
npm run db:generate    # client Prisma
npm run db:deploy      # applique les migrations
npm run db:seed        # donnees de demonstration (--reset pour vider d'abord)
npm run db:migrate -- --name ma_modification
npm run db:studio
```

## Points d'attention

- `DATABASE_URL` : hote **poolee** (`-pooler`) avec `pgbouncer=true`, pour l'application.
- `DIRECT_URL` : hote **direct**, pour les migrations.
- Les noms de champs sont en `snake_case` pour que l'API renvoie le meme JSON qu'avec le mode de secours.
- `SEED_ADMIN_PASSWORD` remplace le mot de passe public `admin123` du compte de demonstration : indispensable en production.
- Apres toute modification du schema, mettez aussi a jour `src/stores/schema.js`.

Guide complet : [docs/DATABASE.md](../../docs/DATABASE.md).
