import _ from 'lodash';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import { Configuration, OpenAIApi } from 'openai';


const mic = require('microphone-stream').default;
const region = "us-west-2";
const credentials = {
  "accessKeyId": "AKIAUQEVMB47ZVBXAYGZ",
  "secretAccessKey": "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",
};
const LanguageCode = "en-US";
const MeidaEncoding = "pcm";
const MediaSampleRateHertz = "16000";

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
const STORAGE_KEY = "almond";
localStorage.setItem(STORAGE_KEY, "");

const STORAGE_KEY_QUESTION = "almond_question";
localStorage.setItem(STORAGE_KEY, "");

const configuration = new Configuration({
  apiKey: "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",
});
const openai = new OpenAIApi(configuration);
const OPENING_WORDS = `You are a helpful assistant to David, who is an Alzheimer patient. You are polite and gentle when he doesn’t remember something, and you’d always respond with a nondeterministic tone, like “I think” or “I believe”.` 
const CONTEXT = `here is the conversation happened before: Lindsey: Aunt Nina is visiting later today! She will bring some flower seeds and help us plant them in our garden! David: That's nice of her. When was the last time we met? Lindsey: Almost a year ago. I know you missed her already.`
let CONTEXT_REAL = `here is the conversation happened before: "${localStorage.getItem(STORAGE_KEY)}"`
const QUESTION = `Now, there's a conversation happening now: David: "That lady who flowered with us on July 2nd, name was... was... starts with letter N I think, or M? What was her name again? She has great taste on flowers." Can you help remind David by responding to him? Let's think step by step. Please start your actual response with "[Actual Response]”`
let QUESTION_REAL = `Now, there's a conversation happening now: David: "${localStorage.getItem(STORAGE_KEY_QUESTION)}" Can you help remind David by responding to him? Let's think step by step. Please start your actual response with "[Actual Response]”`

document.getElementById("start-button").onclick = function () {
    console.log("click on start button");
    // first we get the microphone input from the browser (as a promise)...

    window.navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        })
        .then(streamAudioToWebSocket) 
        .catch(function (error) {
            console.error(error);
        });
};

document.getElementById('stop-button').onclick = function() {
  micStream.stop();
  client.destroy();
};


document.getElementById('show-answer').onclick = async function() {
  micStream.stop();
  client.destroy();
  CONTEXT_REAL = `here is the conversation happened before: "${localStorage.getItem(STORAGE_KEY)}"`
  QUESTION_REAL = `Now, there's a conversation happening now: David: "${localStorage.getItem(STORAGE_KEY_QUESTION)}" Can you help remind David by responding to him? Let's think step by step. Please start your actual response with "[Actual Response]”`

  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {role: "system", content: OPENING_WORDS}, 
      {role: "user", content: CONTEXT_REAL},
      {role: "user", content: QUESTION_REAL}
    ],
  });
  console.log(completion.data.choices[0].message);
  const answer = completion.data.choices[0].message.content.split("[Actual Response]")
  const paragraph = document.getElementById("answer").textContent = answer[1];
};

document.getElementById("resume-button").onclick = function () {
    console.log("click on start button");
    // first we get the microphone input from the browser (as a promise)...

    window.navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        })
        .then(streamQuestionAudioToWebSocket) 
        .catch(function (error) {
            console.error(error);
        });
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
    await handleTextStream(false)
}

let streamQuestionAudioToWebSocket = async function (userMediaStream) {
    //let's get the mic input from the browser, via the microphone-stream module
    micStream = new mic();
    micStream.setStream(userMediaStream);
    audioStream = async function* () {
      for await (const chunk of micStream) {
        yield { AudioEvent: { AudioChunk: pcmEncodeChunk(chunk) /* pcm Encoding is optional depending on the source */ } };
      }
    };
    await sendSpeechStream()
    await handleTextStream(true)
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

async function handleTextStream(isQuestion) {
  for await (const event of transcriptResponse.TranscriptResultStream) {
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
          if (isQuestion) {
            const paragraph = document.getElementById("question");
            textNode.id = prevId;
            paragraph.appendChild(textNode)
          } else {
            const paragraph = document.getElementById("text-results");
            textNode.id = prevId;
            paragraph.appendChild(textNode)          
          }

        }
        (result.Alternatives || []).map((alternative) => {
          const transcript = alternative.Items.map((item) => item.Content).join(" ");
          textNode.textContent = transcript;
          if (!result.IsPartial) {
            if (isQuestion) {
              const currentText = localStorage.getItem(STORAGE_KEY_QUESTION);
              localStorage.setItem(STORAGE_KEY_QUESTION, currentText + transcript);
            } else {
              const currentText = localStorage.getItem(STORAGE_KEY);
              localStorage.setItem(STORAGE_KEY, currentText + transcript);
            }
          }
        })
      })
    }
  }
}

// function streamAudioToWebSocket(stream) {
//   mediaRecorder = new MediaRecorder(stream);
//   mediaRecorder.start();
//   const audioChunks = [];
//   mediaRecorder.addEventListener("dataavailable", event => {
//     audioChunks.push(event.data);
//   })
//   mediaRecorder.addEventListener("stop", () => {
//     const audioBlob = new Blob(audioChunks);
//     const audioUrl = URL.createObjectURL(audioBlob);
//     const audio = new Audio(audioUrl);
//     audio.play();
//   })
// }

// document.getElementById("stop-button").onclick = function () {
//   mediaRecorder.stop();
// };
