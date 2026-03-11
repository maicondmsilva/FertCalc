const url = 'https://vadbhbyfnkrqvboiiakw.supabase.co/rest/v1/pricing_records?limit=1';
const key = 'sb_publishable__FWnHcFLFGXOJCCQru4KiQ_pawDcEsl';

async function testUpdate() {
  const getRes = await fetch(url + '&select=id', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const records = await getRes.json();
  if (records.length === 0) return console.log('No records');
  const id = records[0].id;

  const patchUrl = \`https://vadbhbyfnkrqvboiiakw.supabase.co/rest/v1/pricing_records?id=eq.\${id}\`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ commercial_observation: 'test update' })
  });
  
  const text = await patchRes.text();
  console.log('PATCH response:', patchRes.status, text);
}

testUpdate().catch(console.error);
