
import { TraktClient } from './src/lib/trakt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  const settings = await prisma.setting.findMany();
  const clientId = settings.find(s => s.key === 'TRAKT_CLIENT_ID')?.value;
  const clientSecret = settings.find(s => s.key === 'TRAKT_CLIENT_SECRET')?.value;
  const accessToken = settings.find(s => s.key === 'TRAKT_ACCESS_TOKEN')?.value;

  if (!clientId || !accessToken) {
    console.log('No credentials found');
    return;
  }

  const trakt = new TraktClient(
    clientId,
    clientSecret || '',
    'http://localhost:3000',
    accessToken
  );

  console.log('Fetching watched shows...');
  const data = await trakt.getWatchedShowsRaw();
  if (data.length > 0) {
    console.log('First show:', data[0].show.title);
    console.log('TRAILER:', data[0].show.trailer);
    console.log('TRAILER detected:', !!data[0].show.trailer);
    console.log('Full Item Keys:', Object.keys(data[0].show));
  } else {
    console.log('No watched shows found');
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
