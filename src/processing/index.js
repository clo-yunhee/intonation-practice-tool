import { createMp3Encoder, createOggEncoder } from "wasm-media-encoders";
import GrowableUint8Array from "@fictivekin/growable-uint8-array";
import toWav from "audiobuffer-to-wav";

console.debug(
    "%c⚠️ %cFirefox and Chrome have a bug where web worker console messages are triggered twice.",
    "font-size: 2em",
    "line-height: 2em; font-size: 1.6em"
);

const worker = new Worker(new URL("intonation-practice.js", import.meta.url));

let workerCallbacks;

worker.onmessage = function (e) {
    const { type, data = {} } = e.data;

    switch (type) {
        case "progress":
            workerCallbacks.progress(data);
            break;
        case "finished":
            workerCallbacks.finished(data);
            break;
        default:
            console.warn("Unknown message from the generateAudio worker:", e.data);
            break;
    }
};

export function generateAudio(audioBuffer, callbacks, options) {
    workerCallbacks = callbacks;
    const data = audioBuffer.getChannelData(0);
    worker.postMessage({ data, options });
}

export const emptyAudioBlob = new Blob(
    [
        new DataView(
            toWav(
                new AudioBuffer({
                    length: 1,
                    numberOfChannels: 1,
                    sampleRate: 8000,
                })
            )
        ),
    ],
    {
        type: "audio/wav",
    }
);

export async function encodeToMp3(audioBuffer, vbrQuality = 4) {
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    const encoder = await createMp3Encoder();
    
    encoder.configure({
        sampleRate,
        channels: 1,
        vbrQuality,
    });

    const outBuffer = new GrowableUint8Array();
    let moreData = true;

    while (true) {
        const mp3Data = moreData
            ? encoder.encode([data])
            : /* finalize() returns the last few frames */
                encoder.finalize();

        /* mp3Data is a Uint8Array that is still owned by the encoder and MUST be copied */

        outBuffer.extend(mp3Data);

        if (!moreData) {
            break;
        }

        moreData = false;
    }

    const u8buf = outBuffer.unwrap(true);
    return u8buf.buffer;
}

export async function encodeToOgg(audioBuffer, vbrQuality = 4) {
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    const encoder = await createOggEncoder();
    
    encoder.configure({
        sampleRate,
        channels: 1,
        vbrQuality,
    });

    const outBuffer = new GrowableUint8Array();
    let moreData = true;

    while (true) {
        const oggData = moreData
            ? encoder.encode([data])
            : /* finalize() returns the last few frames */
                encoder.finalize();

        /* oggData is a Uint8Array that is still owned by the encoder and MUST be copied */

        outBuffer.extend(oggData);

        if (!moreData) {
            break;
        }

        moreData = false;
    }

    const u8buf = outBuffer.unwrap(true);
    return u8buf.buffer;
}
