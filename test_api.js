const url = 'https://vadbhbyfnkrqvboiiakw.supabase.co/rest/v1/pricing_records?select=deletion_request&limit=1';
const key = 'sb_publishable__FWnHcFLFGXOJCCQru4KiQ_pawDcEsl';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}).then(res => res.text()).then(console.log).catch(console.error);
