const functions = require('firebase-functions');
// import * as tf from '@tensorflow/tfjs';
// import '@tensorflow/tfjs-node';
// import * as use from '@tensorflow-models/universal-sentence-encoder';
const app = require('./app');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
module.exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);