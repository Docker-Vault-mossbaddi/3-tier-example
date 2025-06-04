const express = require('express');
const { Pool } = require('pg');
const app = express();

// Configuration de la base de données
const pool = new Pool({
  user: 'appuser',
  host: 'db', // Nom du conteneur PostgreSQL
  database: 'myapp',
  password: 'secret123',
  port: 5432,
});

// Middleware pour parser le JSON
app.use(express.json());

// Middleware pour les CORS (si nécessaire)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Route de health check
app.get('/api/health', async (req, res) => {
  try {
    // Test de connectivité à la base de données
    const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    
    res.json({
      status: 'OK',
      message: 'Backend et base de données opérationnels',
      time: result.rows[0].current_time,
      database: {
        connected: true,
        version: result.rows[0].postgres_version.split(' ')[0] + ' ' + result.rows[0].postgres_version.split(' ')[1],
        host: 'db',
        database: 'myapp'
      },
      backend: {
        node_version: process.version,
        uptime: process.uptime() + ' secondes'
      }
    });
  } catch (err) {
    console.error('Erreur de connexion à la base de données:', err);
    res.status(500).json({
      status: 'Error',
      message: 'Erreur de connexion à la base de données',
      error: err.message,
      database: {
        connected: false,
        host: 'db',
        database: 'myapp'
      }
    });
  }
});

// Route pour tester l'insertion de données
app.post('/api/test-data', async (req, res) => {
  try {
    // Créer une table de test si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id SERIAL PRIMARY KEY,
        check_time TIMESTAMP DEFAULT NOW(),
        status VARCHAR(50)
      )
    `);
    
    // Insérer un enregistrement de test
    const result = await pool.query(
      'INSERT INTO health_checks (status) VALUES ($1) RETURNING *',
      ['healthy']
    );
    
    res.json({
      status: 'OK',
      message: 'Données insérées avec succès',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Erreur lors de l\'insertion:', err);
    res.status(500).json({
      status: 'Error',
      message: 'Erreur lors de l\'insertion de données',
      error: err.message
    });
  }
});

// Route pour récupérer les données de test
app.get('/api/test-data', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM health_checks ORDER BY check_time DESC LIMIT 10'
    );
    
    res.json({
      status: 'OK',
      message: 'Données récupérées avec succès',
      count: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('Erreur lors de la récupération:', err);
    res.status(500).json({
      status: 'Error',
      message: 'Erreur lors de la récupération des données',
      error: err.message
    });
  }
});

// Route racine pour les tests
app.get('/', (req, res) => {
  res.json({
    message: 'Backend API - Application 3-tiers Docker',
    endpoints: [
      'GET /api/health - Health check avec test DB',
      'POST /api/test-data - Insérer des données de test',
      'GET /api/test-data - Récupérer les données de test'
    ],
    version: '1.0.0'
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur globale:', err);
  res.status(500).json({
    status: 'Error',
    message: 'Erreur interne du serveur',
    error: err.message
  });
});

// Gestion des routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'Error',
    message: 'Route non trouvée',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend démarré sur le port ${PORT}`);
  console.log(`📡 Endpoints disponibles:`);
  console.log(`   - GET  /api/health`);
  console.log(`   - POST /api/test-data`);
  console.log(`   - GET  /api/test-data`);
  console.log(`🗄️  Connexion à la base de données: db:5432/myapp`);
});

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt du serveur en cours...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Signal SIGTERM reçu, arrêt propre...');
  await pool.end();
  process.exit(0);
}); 