'use strict';
require('@tensorflow/tfjs');
const tf=require('@tensorflow/tfjs-node');
const use = require('@tensorflow-models/universal-sentence-encoder');
const functions = require('firebase-functions');
const {
    dialogflow,
    SignIn,
    Suggestions,
    BasicCard, 
    List,
    Table
} = require('actions-on-google');
const app = dialogflow({
    clientId: "776729479381-jsrt0la1m9dnbqr0ptfm8k5g7k5l207i.apps.googleusercontent.com",
    debug: true,
}

);

var admin = require("firebase-admin");


var serviceAccount = require("./service-account.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://answerme-eiwcbh.firebaseio.com"
});
// const auth = admin.auth();
var db = admin.firestore();
// function dot(a,b){
//     let dot_product = 0;
//     for (key in a) {
//         dot_product += a[key] * b[key];    
//     }
    
//     return dot_product;
// }
async function  cosineSimiarity(x1, x2) {
// todo create 2d tensor from x2;
    x2 = tf.stack(x2);
    x1 = tf.reshape(x1, [1, 512]);
    console.log(x2.shape);
    console.log(x1.shape);
   
    var mA = 0;
    var mB = 0;
    const axis = 1;
    const dotProductMatrix=tf.sum(tf.mul(x1,x2),axis);
    mA = tf.sqrt(tf.sum(tf.mul(x1, x1), axis));
    mB = tf.sqrt(tf.sum(tf.mul(x2, x2), axis));
    const mAmB = tf.mul(mA,mB);
    const similarityMatrix = tf.div(dotProductMatrix, mAmB);
    
     // here you needed extra brackets
    return await similarityMatrix.data();
   
}

// use.load().then(model => {
//     const sentences = [
//         'Hello.',
//         'How are you?'
//     ];
//     model.embed(sentences).then(embeddings => {
//         embeddings.print(true /* verbose */);
//     });
// });
async function getAllQuestions() {
    let questionList = [];
    try {
        let querySnapshot = await db.collection('questions').get();
        
        querySnapshot.forEach(snapshot => {
            questionList.push({
                id: snapshot.id,
                data: snapshot.data()
            });
        });
       

     } catch (error) {
        console.log('error in riterving the document', error);        
    }
    return questionList;

    
    
    
        
}
async function getEncodings(sentenceArray) { 
    console.log('i am  creaing encoding');
    // try {
    //     const model = await use.load();
    //     const embeddings = await model.embed(sentenceArray);
    //     console.log('i have created embeddings ');
    //     console.log(embeddings);
    //     return embeddings;    
    // } catch (err) {
    //     console.log('error in getting embeddings', err);
        
    // }
    // return false;
    const model = await use.load();
    console.log(sentenceArray);

        const embeddings = await model.embed(sentenceArray);
        console.log('i have created embeddings ');
        console.log(embeddings);
        return embeddings;
    
}
async function getSimilarQuestion(sentence) {
    // find out the best possible  similar question fro tha database
    let questionSimilarities = [];
    // var queryEmbedding = await getEncodings(sentence);
    // queryEmbedding = queryEmbedding[0];
    // if (queryEmbedding === false) {
    //     console.log('error');
    //     return false;
    // }
    
    var questionDocumentList= await getAllQuestions();
    
    //  TOdo add sentence to questionList at 0th index 
    console.log(questionDocumentList)
    if (questionDocumentList &&questionDocumentList.length) {
        // not empty 

        // array of all the quesitons

        let questionList = [sentence];
        for (let questionDoc of questionDocumentList) {
            questionList.push(questionDoc.data.question);
        }


        console.log('this is questionList from getAllQuestions', questionList);
        let max_similarity_index = 0
        let max_similarity_value = 0
        // lets get all encodings
        var embeddings = await getEncodings(questionList);
        // calculate cosine similarity for each of the question 
        console.log(embeddings);
        var embeddingsData = tf.unstack(embeddings);
        console.log(embeddingsData);
       
       //todo create cosinesimlarity matrix 
        const similarityMatrix=await cosineSimiarity(embeddingsData[0], embeddingsData.slice(1,)); 
        for (let x = 0; x < similarityMatrix.length; x++) {
            if (max_similarity_value < similarityMatrix[x]){
                max_similarity_value = similarityMatrix[x];
                max_similarity_index = x;
            }

            
        }
       
        return questionDocumentList[max_similarity_index];

    } else {
        // empty
        return;
    }
   
   
    // todo getAllquestions-> getAllencodings-> for each cosineSimilarity


}

var tags = ['financial', 'academic', 'general'];
app.intent('cust.welcome', (conv) => {
    const userId = conv.user.storage.userId;
    const userName = conv.user.storage.userName;
    if (userId) {
        conv.ask(`Hi\n I welcome back ${userName}`);
        conv.ask("please enter you email id to start");
        conv.ask(new Suggestions([
            `${userId}`,
            'logout',
        ]));
        return;
    }
    conv.contexts.set('getEmail', 1);
    conv.ask('Hi \n please enter your email to login');

});
app.intent('cust.welcome - email', async (conv, param) => {
    const userId = param.userId;
    try {
        let user = await (db.collection('users').doc(userId).get());
        if (!user.exists) {

            conv.ask(
                "This is the first time that you are login into the portal.\n I am creating an account with this name"
            );
            conv.contexts.set("signUpName", 1);
            conv.ask("please enter your name");
            conv.user.storage.userId = userId;
            return;
        } else {
            conv.user.storage.userId = userId;
        }
    } catch (err) {
        console.log(err);
        conv.ask('something went wrong');
        conv.contexts.set('errorHandler', 1);
    }
    conv.ask('What do you want to do');
    conv.ask(new Suggestions([
        'ask question',
        'answer question',
        'know status',
    ]));

});
app.intent('user.name', async (conv, param) => {
    const userId = conv.user.storage.userId;

    try {
        let user = await db.collection('users').doc(userId).set({
            name: param.name
        });
    } catch (err) {
        console.log(err, 'error creating user');

    }
    conv.contexts.set('signUpOccupation', 1);
    conv.ask('please enter your occupation');
});
app.intent('user.occupation', async (conv, param) => {
    const userId = conv.user.storage.userId;
    try {
        let user = await db
            .collection("users")
            .doc(userId)
            .update({
                occupation: param.occupation
            });

    } catch (err) {
        console.log(err, "error addind occupation");
    }

    conv.ask("you have been registerd");
    conv.ask("What do you want to do");
    conv.ask(
        new Suggestions(["ask question", "answer question", "know status"])
    );
});
app.intent('logout', (conv) => {
    conv.user.storage = {};
    conv.close('Thank you have a nice day');
});
app.intent('ask.question', (conv) => {
    conv.ask('please ask your question after this message');
    conv.contexts.set('questionFallback', 1);
});
app.intent('ask.question - fallback', async (conv) => {
    const userQuery = conv.query;
    conv.data.currentQuery = userQuery;
    
    const userId = conv.user.storage.userId;
    try {
        // call api to get reponse
        const response = await getSimilarQuestion(userQuery);
        console.log(response);
        conv.user.storage.previousQuestion = response.id;
        // console.log('this is responce data', response.data);
        if (response.data.hasOwnProperty('answer')) { 
            conv.ask(response.data.question + '\n' + response.data.answer + '\n\n' + 'does this answer solve your query');
            
        } else {
            conv.ask(response.data.question);
            conv.ask('\n This question is already posted but havent answered you can \n check out answer later \n if you think your question is different you can post it.');
        }
        
    } catch (err) {
        console.log(err, 'error in api calling');
    }
       conv.ask(new Suggestions(
        [
            'yes',
            'no'
        ]
    ));
    conv.contexts.set('queryResolve', 1);

});
app.intent('ask.question - fallback - yes', (conv) => {
    conv.ask('I am glad that i could help you');
    conv.ask(new Suggestions([
        'ask quesion',
        'answer question',
    ]));
});
app.intent("ask.question - fallback - no", (conv) => {

    conv.ask("Do you want to post this query");
    conv.ask(new Suggestions(["yes", "no"]));
    conv.contexts.set('queryRegister', 1);

});

app.intent("ask.question - fallback - no - yes", (conv) => {
    conv.ask("please select an appropriate tag for your query");
    conv.ask(new Suggestions(tags));
    conv.contexts.set('queryTag', 1);

});

app.intent("ask.question - fallback - no - no", (conv) => {
    conv.close("Thank you have a good day ");

});

app.intent("ask.question - fallback - no - yes - custom", async (conv, param) => {
    //   query has registed 
    const queryTag = param.tagName;
    const userId = conv.user.storage.userId;
    
    //
    // todo add question to question collection
    // Todo Toggle box 

    try {
        let quessionRef = await db.collection('questions').doc().set({
            question: conv.data.currentQuery,
            tags: queryTag,
            askedBy: userId
        });
        conv.user.storage.previousQuestion = quessionRef.id;
        let userQuestion = db.collection('users').doc(userId);

        // Atomically add a new region to the "regions" array field.
        let addQuestion = userQuestion.update({
            questions: admin.firestore.FieldValue.arrayUnion('/questions/'.concat(`${quessionRef.id}`))
        });
        conv.ask("Your query has posted");
        conv.ask("please check after sometime");
    } catch (err) {
        console.log(err, 'error creating user');

    }
    //todo add quesion to user collection question subdocument
    
    

    conv.ask(new Suggestions('ask question', 'answer question'));

});
app.intent("answer.question", (conv) => {
    conv.ask("please select an category you want to answer question from");
    conv.ask("general contains the questions that didnt have other related tags");
    conv.ask(new Suggestions(tags));
    
});
app.intent('answer.question - get tags', async (conv, param) => {
    var tag = param.tags;
    // todo call get question api for tagName=tag
    let questionMap = [];
    try {
        let questionQuery = db.collection('questions');
        let questionCollection = await questionQuery.where('tags', '==', `${tag}`).get();
        console.log('trying to acess database');
        if (questionCollection.empty) {
            console.log(questionCollection);
            conv.ask('there is no question in that category');
            return;
        }
        let questionList = [];
        questionCollection.forEach(question => {
            if (!question.data().hasOwnProperty('answer')) { 
                questionList.push({ id: question.id, question: question.data().question });
                console.log(question.id, '=>', question.data().question);
            }
            //ONLY ADD QUESSTIONS THAT DONT HAVE ANSWERS
            
        });
        let quesionMap = []
        let indexList = [];
        for (let index = 0; index < questionList.length; index++) {
            indexList.push(`${index}`);
            quesionMap.push([`${index}`, questionList[index].question]);
        }
        conv.ask('question list');
        conv.data.questionList = questionList;
        conv.ask(new Table({
            dividers: true,
            columns: [{
                header: 'Id',
                align: 'CENTER',
            },
                {
                    header: 'Question',
                    align: 'LEADING',
                },],
            
            rows: quesionMap,
        }))
        console.log(quesionMap);
        console.log(questionList);
        console.log(questionCollection);
        conv.ask(new Suggestions(indexList));

    }
    catch (err) {
        console.log('something is wrong with database coneection', err);
        conv.ask('something is wrong with database coneection');
    }
    
    

});
app.intent('answer.question - select question number', (conv, param) => {
    const questionNumber = param.questionNumber;
    conv.ask('please enter the answer after this message');
    conv.data.questionNumber = parseInt(questionNumber);
    

});
app.intent('answer.question - fallback', (conv) => {
    const answer = conv.query;
    const questionNumber = conv.data.questionNumber;

    const questionId = conv.data.questionList[questionNumber]['id'];
    // Todo add the answer to question where id = questionId  
    let docUpdated = db.collection('questions').doc(questionId).update({
        answer: answer
    });
    conv.ask('Thankyou for helping the community');
    conv.ask(new Suggestions([
        'answer  question', 'ask question', 'check status', 'good bye'
    ]));
});
app.intent('conv.close', (conv) => {
    conv.close('good bye. Have a nice day');
});
app.intent('know.status.previous', async (conv) => {
    // todo get status of previous quesiton or 

    console.log('know status previous intent detected');
    if (conv.user.storage.hasOwnProperty('previousQuestion')) {
        console.log('previous question found');
        // get status of only previous question
        var question=await db.collection('questions').doc(conv.user.storage.previousQuestion).get();       
        if (question.data().hasOwnProperty('answer')) {
            console.log('answer  found ');
            conv.ask(`here is the answer of your previously asked question \n${question.data().question}\n${question.data().answer}`);            
        } else {
            console.log('answer  found ');
            conv.ask(`you question\n${question.data().question}\n has not answered till now.`);
            
        }
       
    }
    else {
        //todo get status of all the status
        console.log('else previous question');

        conv.ask('we couldnt get your previous question. you can ask for status of all questions to get status of all questions asked till now');
    }
    conv.ask(new Suggestions([
        'answer question', 'ask question'
    ]));
});

//todo create handler for delete.previous.question

app.intent("know.status.all", (conv) => {
    //todo get status of all the status
   
    conv.ask(
        "Here is the status of all your question"
    );

});
// todo check all conv.user.storage if they can be changed by conv.data

module.exports = app;