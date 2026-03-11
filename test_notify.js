const url = 'https://vadbhbyfnkrqvboiiakw.supabase.co/rest/v1/notifications';
const key = 'sb_publishable__FWnHcFLFGXOJCCQru4KiQ_pawDcEsl';

const payload = {
  title: 'Test',
  message: 'Test message',
  date: new Date().toISOString(),
  read: false,
  type: 'pricing_deletion_request'
};

fetch(url, {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify(payload)
}).then(res => res.text()).then(console.log).catch(console.error);
