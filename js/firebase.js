const firebaseConfig = {
  apiKey: "AIzaSyD738ADvhVTT-_vQmLoHm4aRx9z4DaR8kc",
  authDomain: "whisky-notes-4e781.firebaseapp.com",
  projectId: "whisky-notes-4e781",
  storageBucket: "whisky-notes-4e781.firebasestorage.app",
  messagingSenderId: "914139253550",
  appId: "1:914139253550:web:00370608ad2f57cc7d88bf"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
let _cloudUserId = null;

const _authReady = firebase.auth().signInAnonymously()
  .then(cred => { _cloudUserId = cred.user.uid; })
  .catch(() => {});

async function syncNoteToCloud(note) {
  if (Storage.getSetting('cloudConsent') !== true) return;
  await _authReady;
  if (!_cloudUserId) return;

  const typeLabel = note.type === 'custom'
    ? (note.typeCustom || '기타')
    : (DRINK_TYPES.find(t => t.value === note.type)?.label || note.type || '');

  const regionLabel = REGIONS.find(r => r.value === note.region)?.label || note.region || '';

  const doc = {
    userId:     _cloudUserId,
    date:       note.date || '',
    drinkName:  note.name || '',
    type:       typeLabel,
    region:     regionLabel,
    abv:        note.abv || null,
    nose:       note.nose || '',
    palate:     note.palate || '',
    finish:     note.finish || '',
    noseScore:  note.noseScore  ?? null,
    palateScore:note.palateScore ?? null,
    finishScore:note.finishScore ?? null,
    score:      note.score ?? null,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
  };

  db.collection('hanju_tastings').add(doc).catch(() => {});
}
