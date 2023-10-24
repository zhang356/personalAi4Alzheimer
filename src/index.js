import axios from "axios";

const headers = {
    authorization: "sk-7t5ag0jovi0f9ccb0okxaiesgmwzzxcodv17g81gpve9o9evmhzggas3t035u52169",
};

let currentCallId = "";

async function getTranscript() {
    try {
        const response = await axios.post("https://almondear.bland.ai/logs", { call_id: currentCallId}, { headers });
        console.log(response);
        document.getElementById("transcript").textContent= JSON.stringify(response.data, undefined, 2);
    } catch (error) {
        alert (error);
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

    setInterval(getTranscript, 2000);

};
