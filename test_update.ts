import { updatePricingRecord, getPricingRecords } from './src/services/db';
import { supabase } from './src/services/supabase';

async function test() {
  const pricings = await getPricingRecords();
  if (pricings.length > 0) {
    const pricing = pricings[0];
    console.log('Testing with pricing_record ID:', pricing.id);
    try {
      await updatePricingRecord(pricing.id, {
        deletionRequest: {
             reason: 'Test Reason',
             requestedBy: pricing.userId,
             userName: pricing.userName || 'Test',
             date: new Date().toISOString(),
             status: 'Pendente'
        }
      });
      console.log('Successfully updated pricing_record');
    } catch(err) {
      console.error('Error updating pricing_record:', err);
    }
  } else {
    console.log('No pricing records found.');
  }
}

test();
