function callback(type) {
    return function(data) {
        postMessage({ type, data });
    }
}

onmessage = function(e) {
    const { data, options } = e.data;
    
    const {
        sampleRateOut,
        pitchMorph,
        filterMorph,
        synthMethod,
        loPitch,
        hiPitch,
    } = options;

    // Get data byte size, allocate memory on Emscripten heap, and get pointer
    const nDataBytes = data.length * data.BYTES_PER_ELEMENT;
    const dataPtr = Module._malloc(nDataBytes);

    // Calculate output length, then do the same
    const nOutLength = Math.round((data.length * sampleRateOut) / 16000);

    const nOutBytes = nOutLength * data.BYTES_PER_ELEMENT;
    const outPtr = Module._malloc(nOutBytes);

    // Copy data to Emscripten heap (directly accessed from Module.HEAPU8)
    const dataHeap = new Uint8Array(Module.HEAPU8.buffer, dataPtr, nDataBytes);
    dataHeap.set(new Uint8Array(data.buffer));

    const outHeap = new Uint8Array(Module.HEAPU8.buffer, outPtr, nOutBytes);

    // Call the C++ generateAudio function
    Module._generateAudio(
        dataHeap.byteOffset,
        data.length,
        outHeap.byteOffset,
        nOutLength,
        sampleRateOut,
        pitchMorph,
        filterMorph,
        synthMethod,
        loPitch,
        hiPitch,
        callback("progress")
    );
    
    // Make a new data view
    const updatedOutHeap = new Uint8Array(Module.HEAPU8.buffer, outPtr, nOutBytes);

    // Get result and free Emscripten memory
    const resultOrig = new Float32Array(updatedOutHeap.buffer, updatedOutHeap.byteOffset, nOutLength);
    const resultCopy = new Float32Array(resultOrig);
    
    Module._free(dataHeap.byteOffset);
    Module._free(updatedOutHeap.byteOffset);

    postMessage({
        type: "finished",
        data: resultCopy
    });
}
