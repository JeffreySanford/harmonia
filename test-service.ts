import { InstrumentCatalogService } from '../apps/backend/src/songs/instrument-catalog.service';

async function testService() {
  console.log('Testing instrument catalog service...');

  const service = new InstrumentCatalogService();

  try {
    const result = await service.loadCatalog().toPromise();
    console.log('Service result:', result);
    console.log('Test passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testService();
