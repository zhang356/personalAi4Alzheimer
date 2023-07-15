import { PROMPT_QUESTION, PROMPT_CONTEXT, PROMPT_ANSWER } from './constants';

async function askRelevanceAi() {
  console.log("begin storeText2RelevanceAi")
  const url = "https://api-bcbe5a.stack.tryrelevance.com/latest/studios/cbf3109c-d8c5-41ad-b630-f5c7f37001ac/trigger_limited";
  const question = localStorage.getItem(PROMPT_QUESTION);
  const context = localStorage.getItem(PROMPT_CONTEXT);
  const data = {"params":{"long_text_variable": context, "text_variable": question},"project":"6f770fda6633-4dee-a99c-f8e72bce8f69"};
  const response = await fetch(url, {
    method: "POST", // *GET, POST, PUT, DELETE, etc.
    mode: "cors", // no-cors, *cors, same-origin
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    credentials: "same-origin", // include, *same-origin, omit
    headers: {
      "Content-Type": "application/json",
    },
      redirect: "follow", // manual, *follow, error
      referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
    const responseJson = await response.json()
    console.log(`query vectorDB resposne: ${responseJson}`);
    return responseJson.output.answer;
}

async function storeText2RelevanceAi() {
  console.log("begin storeText2RelevanceAi")
  const url = "https://api-bcbe5a.stack.tryrelevance.com/latest/studios/78c1304b-93d2-40e4-abc6-c597a1d57cf9/trigger_limited";
  const question = localStorage.getItem(PROMPT_QUESTION);
  const context = localStorage.getItem(PROMPT_CONTEXT);
  const answer = localStorage.getItem(PROMPT_ANSWER);
  const longTermMemeory = context + question + answer;
  console.log(`Text to store in longterm memory: ${longTermMemeory}`);
  const data = {"params":{"long_text_variable": longTermMemeory },"project":"6f770fda6633-4dee-a99c-f8e72bce8f69"};
  const response = await fetch(url, {
    method: "POST", // *GET, POST, PUT, DELETE, etc.
    mode: "cors", // no-cors, *cors, same-origin
    cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    credentials: "same-origin", // include, *same-origin, omit
    headers: {
      "Content-Type": "application/json",
    },
      redirect: "follow", // manual, *follow, error
      referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
    const responseJson = await response.json()
    console.log(`longterm memory response: ${responseJson}`);
    return responseJson.output;
}

export {
	askRelevanceAi,
	storeText2RelevanceAi
}