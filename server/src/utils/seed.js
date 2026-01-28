require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seed() {
  console.log('Starting database seed...');

  try {
    // Read locations from data.json
    const dataPath = path.join(__dirname, '../../../data.json');

    if (!fs.existsSync(dataPath)) {
      console.error('data.json not found at:', dataPath);
      process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const locations = JSON.parse(rawData);

    console.log(`Found ${locations.length} locations in data.json`);

    // Clear existing locations (optional - comment out to preserve existing data)
    console.log('Clearing existing locations...');
    await prisma.location.deleteMany();

    // Insert locations
    console.log('Inserting locations...');

    for (const location of locations) {
      await prisma.location.create({
        data: {
          id: location.id,
          name: location.name,
          type: location.type,
          category: location.category,
          address: location.address,
          lat: location.lat,
          lng: location.lng,
          phone: location.phone || null,
          website: location.website || null,
          hours: location.hours || null,
          accepts: location.accepts || [],
          description: location.description || null,
          isPending: false
        }
      });
      console.log(`  Added: ${location.name}`);
    }

    // Reset the auto-increment sequence to continue from max id
    const maxId = Math.max(...locations.map(l => l.id));
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Location"', 'id'), ${maxId}, true)`;
    console.log(`Set sequence to start after id ${maxId}`);

    // Verify
    const count = await prisma.location.count();
    console.log(`\nSeed completed! ${count} locations in database.`);

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
