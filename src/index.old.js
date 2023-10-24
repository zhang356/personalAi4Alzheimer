import _ from 'lodash';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import { Configuration, OpenAIApi } from 'openai';
import './style.scss';
import { askRelevanceAi, storeText2RelevanceAi } from './RelevanceAi';
import { PROMPT_QUESTION, PROMPT_CONTEXT, PROMPT_ANSWER} from "./constants"

const mic = require('microphone-stream').default;
const region = "us-west-2";

const LanguageCode = "en-US";
const MeidaEncoding = "pcm";
const MediaSampleRateHertz = "16000";
const INTRO_TEXT = "Hey Lindsey, I’m Almond, David’s new friend. Hmm… let me think…";



let keysResponse = await fetch("https://almond-recordings-public.s3.us-west-2.amazonaws.com/keys2.json");
let allKeys = await keysResponse.json();
console.log(allKeys);


const credentials = {
  "accessKeyId": allKeys[0].aws.keyId,
  "secretAccessKey": allKeys[0].aws.secretAccessKey,
};
const client = new TranscribeStreamingClient({
  region,
  credentials,
});

let mediaRecorder;
let audioStream;
let micStream;
let inputSampleRate;
let transcriptResponse;
let prevId = "";      
let textNode;

const APP_STATE = {
  RECORD_CONTEXT: "RECORD_CONTEXT", 
  RECORD_QUESTION: "RECORD_QUESTION",
  SHOW_ANSWER: "SHOW_ANSWER",
}
let appState = APP_STATE.RECORD_CONTEXT;

localStorage.setItem(PROMPT_CONTEXT, "");
localStorage.setItem(PROMPT_QUESTION, "");
localStorage.setItem(PROMPT_ANSWER, "");

const configuration = new Configuration({
  apiKey: allKeys[0].openAi,
});
const openai = new OpenAIApi(configuration);

document.getElementById('show-answer').onclick = async function() {
  micStream.stop();
  client.destroy();
  const introElement = document.createElement('Audio');
  introElement.src = "https://almond-recordings-public.s3.us-west-2.amazonaws.com/letmethink.m4a";
  introElement.play();
  document.getElementsByClassName("answer-section")[0].style.visibility = "visible";
  document.getElementsByClassName("answer")[0].textContent = INTRO_TEXT;

  appState = APP_STATE.SHOW_ANSWER;
  const speech = await askRelevanceAi();
  localStorage.setItem(PROMPT_ANSWER, speech);
  const [text2SpeechCall, storeText2RelevanceAiCall] = await Promise.all([
    text2Speech(speech), 
    storeText2RelevanceAi()
  ])
};

let showAnswerOld = async function() {
  micStream.stop();
  client.destroy();
  QUESTION_REAL = `Now, there's a conversation happening now: David: "${localStorage.getItem(PROMPT_QUESTION)}" Can you help remind David by responding to him? Let's think step by step. Please start your actual response with "[Actual Response]”`

  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {role: "system", content: OPENING_WORDS}, 
      {role: "user", content: QUESTION_REAL}
    ],
  });
  console.log(completion.data.choices[0].message);
  const answer = completion.data.choices[0].message.content.split("[Actual Response]")
  const paragraph = document.getElementsByClassName("answer")[0].textContent = answer[1];
};

document.getElementById("record-button").onclick = function () {
    console.log("click on reocrd button");
    appState = APP_STATE.RECORD_CONTEXT;
    console.log(appState);
    // first we get the microphone input from the browser (as a promise)...
    localStorage.setItem(PROMPT_CONTEXT, "");
    if (micStream) {
      reset()
    } else {
        window.navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        })
        .then(streamAudioToWebSocket) 
        .catch(function (error) {
            console.error(error);
        });
    }
};

document.getElementById("question-button").onclick = function () {
    console.log("click on quesiton button");
    // first we get the microphone input from the browser (as a promise)...
    localStorage.setItem(PROMPT_QUESTION, "");
    appState = APP_STATE.RECORD_QUESTION;
    console.log(appState);
};

let streamAudioToWebSocket = async function (userMediaStream) {
    //let's get the mic input from the browser, via the microphone-stream module
    micStream = new mic();
    micStream.setStream(userMediaStream);
    audioStream = async function* () {
      for await (const chunk of micStream) {
        yield { AudioEvent: { AudioChunk: pcmEncodeChunk(chunk) /* pcm Encoding is optional depending on the source */ } };
      }
    };
    await sendSpeechStream()
    await handleTextStream()
}

async function sendSpeechStream() {
      const command = new StartStreamTranscriptionCommand({
      // The language code for the input audio. Valid values are en-GB, en-US, es-US, fr-CA, and fr-FR
      LanguageCode: "en-US",
      // The encoding used for the input audio. The only valid value is pcm.
      MediaEncoding: "pcm",
      // The sample rate of the input audio in Hertz. We suggest that you use 8000 Hz for low-quality audio and 16000 Hz for
      // high-quality audio. The sample rate must match the sample rate in the audio file.
      MediaSampleRateHertz: 44100,
      AudioStream: audioStream(),
    });
    transcriptResponse = await client.send(command);
}



const pcmEncodeChunk = (chunk) => {
  const input = mic.toRaw(chunk);
  let offset = 0;
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return Buffer.from(buffer);
};

async function handleTextStream() {
  for await (const event of transcriptResponse.TranscriptResultStream) {
    if (appState === APP_STATE.SHOW_ANSWER) {
      continue; 
    }
    if (event.TranscriptEvent) {
      const message = event.TranscriptEvent;
      // Get multiple possible results
      const results = event.TranscriptEvent.Transcript.Results;
      // Print all the possible transcripts

      results.filter(result => result.ResultId).map((result) => {
        console.log(`prevId: ${prevId}`);
        console.log(`result.ResultId: ${result.ResultId}`);

        if (result.ResultId !== prevId) {
          textNode = document.createTextNode("...");
          prevId = result.ResultId;
          if (appState === APP_STATE.RECORD_CONTEXT) {
            const paragraph = document.getElementsByClassName("context-section")[0];
            textNode.id = prevId;
            paragraph.appendChild(textNode)           
          } else if (appState === APP_STATE.RECORD_QUESTION) {
            const section = document.getElementsByClassName("question-section")[0];
            section.style.visibility = "visible";
            const paragraph = document.getElementsByClassName("question")[0];
            textNode.id = prevId;
            paragraph.appendChild(textNode)
          }
        }
        (result.Alternatives || []).map((alternative) => {
          const transcript = alternative.Items.map((item) => item.Content).join(" ");
          textNode.textContent = transcript;
          console.log("begin storing");
          if (!result.IsPartial) {
            if (appState === APP_STATE.RECORD_QUESTION) {
              console.log("storing quesion");
              const currentText = localStorage.getItem(PROMPT_QUESTION);
              localStorage.setItem(PROMPT_QUESTION, currentText + transcript);
              const paragraph = document.getElementsByClassName("question")[0];
              paragraph.style.backgroundColor = "rgb(196, 122, 72)";
              setTimeout(() => {
                paragraph.style.backgroundColor = "rgb(206, 202, 195)";
              }, "500");
            } else if (appState === APP_STATE.RECORD_CONTEXT) {
              console.log("storing context");
              const currentText = localStorage.getItem(PROMPT_CONTEXT);
              localStorage.setItem(PROMPT_CONTEXT, currentText + transcript);
              const paragraph = document.getElementsByClassName("context-section")[0];
              paragraph.style.backgroundColor = "rgb(196, 122, 72)";
              setTimeout(() => {
                paragraph.style.backgroundColor = "rgb(237, 232, 226)"; // this sets the color back to main body background
              }, "500");
            }
          }
        })
      })
    }
  }
}

async function text2Speech(speechText) {
  console.log("begin text2Speech")
  const url = "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?optimize_streaming_latency=0";
  const data = {
    "text": speechText,
    "model_id": "eleven_monolingual_v1",
    "voice_settings": {
      "stability": 0,
      "similarity_boost": 0,
      "style": 0.5,
      "use_speaker_boost": false
    }
  };
  const response = await fetch(url, {
    method: "POST", // *GET, POST, PUT, DELETE, etc.
    mode: "cors", // no-cors, *cors, same-origin
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    credentials: "same-origin", // include, *same-origin, omit
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": allKeys[0].elevenLabs,
    },
      redirect: "follow", // manual, *follow, error
      referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
  const speechBlob = await response.blob(); 
  const speechUrl = URL.createObjectURL(speechBlob);
  const speechElement = document.createElement('Audio')
  speechElement.src = speechUrl;
  speechElement.play();
  document.getElementsByClassName("answer")[0].textContent += speechText;
  // document.getElementsByClassName("answer-section")[0].style.visibility = "visible";
  console.log("end text2Speech")
}

function reset() {
  appState = APP_STATE.RECORD_CONTEXT;
  localStorage.setItem(PROMPT_CONTEXT, "");
  localStorage.setItem(PROMPT_QUESTION, "");
  localStorage.setItem(PROMPT_ANSWER, "");
  document.getElementsByClassName("question")[0].textContent = ""  
  document.getElementsByClassName("answer")[0].textContent = ""  
  document.getElementsByClassName("context-section")[0].textContent = ""  

  document.getElementsByClassName("answer-section")[0].style.visibility = "hidden";
  document.getElementsByClassName("question-section")[0].style.visibility = "hidden";
}

// window.speech = await text2Speech();

