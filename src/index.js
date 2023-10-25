import axios from "axios";

const headers = {
    authorization: "sk-7t5ag0jovi0f9ccb0okxaiesgmwzzxcodv17g81gpve9o9evmhzggas3t035u52169",
};

let currentCallId = "";
let myInterval;

async function getTranscript() {
    try {
        const response = await axios.post("https://almondear.bland.ai/logs", { call_id: currentCallId }, { headers });
        console.log(response);
        document.getElementById("transcript").textContent= JSON.stringify(response.data, undefined, 2);
        if (response.data.completed) {
            clearInterval(myInterval);
        }
    } catch (error) {
        alert (`get transcript error ${error}`);
    }
}

async function endCall() {
    try {
        const response = await axios.post("https://almondear.bland.ai/end", { call_id: currentCallId }, { headers });
        alert(JSON.stringify(response.data));
    } catch (error) {
        alert (`end call error: ${error}`);
    }
}

document.getElementById("call-button").onclick = async function () {
    const callData = document.getElementById("data-json").value;
    const callDataJson = JSON.parse(callData)
    console.log(callDataJson);
    try {
        const result = await axios.post("https://almondear.bland.ai/call", callDataJson, { headers });
        console.log(result);
        currentCallId = result.data.call_id;
    } catch(error) {
        alert(error);
    }
    myInterval = setInterval(getTranscript, 2000);
};

document.getElementById("end-button").onclick = async function () {
    await endCall();
    clearInterval(myInterval);
};
