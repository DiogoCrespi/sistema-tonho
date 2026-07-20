const knex = require('knex');
const knexfile = require('../../knexfile');

async function main() {
  const env = process.env.NODE_ENV || 'development';
  const config = knexfile[env] || knexfile.development;
  const db = knex(config);

  try {
    const [completed, pending] = await db.migrate.list();
    console.log(`[Migrations Check] Environment: ${env}. Completed: ${completed.length}, Pending: ${pending.length}`);
    for (const p of pending) {
      console.log(` - Pending file: ${p.file}`);
    }
  } finally {
    await db.destroy();
  }
}

main().catch(error => {
  console.error('[Migrations Check Failed]:', error.message);
  process.exit(1);
});
