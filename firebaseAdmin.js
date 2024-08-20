const admin = require('firebase-admin');
const serviceAccount = require('./nsjnu-d8a4e-firebase-adminsdk-q55bi-cdebfb948d.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
