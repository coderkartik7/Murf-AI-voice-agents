let ws = null;
let isRecording = false;
let audioBuffer = [];
let audioContext = null;
let processor = null;
let source = null;
let stream = null;
let audioChunks = [];
let isPlayingAudio = false;
let isBuffering = true;
let playheadTime = 0;

// Calculate proper buffer size for 200ms chunks at 16kHz
const SAMPLE_RATE = 16000;
const CHUNK_DURATION_MS = 100; // 200ms chunks (well within 50-1000ms requirement)
const SAMPLES_PER_CHUNK = (SAMPLE_RATE * CHUNK_DURATION_MS) / 1000;
const BYTES_PER_CHUNK = SAMPLES_PER_CHUNK * 2; // 2 bytes per 16-bit sample

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const messages = document.getElementById('messages');

startBtn.onclick = startRecording;
stopBtn.onclick = stopRecording;

function sendAudioChunk() {
    if (audioBuffer.length === 0 || !ws || ws.readyState !== WebSocket.OPEN) return;

    // Calculate total samples needed for our target duration
    const totalSamples = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    
    if (totalSamples < SAMPLES_PER_CHUNK) return; // Wait for more data

    // Take exactly the amount we need for our chunk duration
    const chunkBuffer = new Int16Array(SAMPLES_PER_CHUNK);
    let samplesUsed = 0;
    let bufferIndex = 0;

    while (samplesUsed < SAMPLES_PER_CHUNK && bufferIndex < audioBuffer.length) {
        const currentChunk = audioBuffer[bufferIndex];
        const samplesNeeded = SAMPLES_PER_CHUNK - samplesUsed;
        const samplesToTake = Math.min(samplesNeeded, currentChunk.length);

        chunkBuffer.set(currentChunk.subarray(0, samplesToTake), samplesUsed);
        samplesUsed += samplesToTake;

        if (samplesToTake < currentChunk.length) {
            // Keep the remaining part of this chunk
            audioBuffer[bufferIndex] = currentChunk.subarray(samplesToTake);
        } else {
            // Remove this chunk entirely
            bufferIndex++;
        }
    }

    // Remove used buffers
    audioBuffer = audioBuffer.slice(bufferIndex);

    // Send the properly sized chunk
    console.log(`Sending audio chunk: ${chunkBuffer.length} samples (${CHUNK_DURATION_MS}ms)`);

    // Safety check for chunk size (max 800ms to be safe)
    const maxSamples = (SAMPLE_RATE * 800) / 1000;
    if (chunkBuffer.length > maxSamples) {
        console.log("Chunk too large, skipping");
        return;
    }

    ws.send(chunkBuffer.buffer);
}

async function startRecording() {
    try {
        // Reset buffers
        audioBuffer = [];
        
        ws = new WebSocket('ws://127.0.0.1:8000/ws');
        
        ws.onopen = () => {
            status.textContent = 'Connected';
            status.className = 'status connected';
            ws.send(JSON.stringify({type: 'start'}));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received:', data.type);
            handleMessage(data);
        };
        
        ws.onclose = () => {
            status.textContent = 'Disconnected';
            status.className = 'status disconnected';
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            status.textContent = 'Connection Error';
            status.className = 'status disconnected';
        };

        stream = await navigator.mediaDevices.getUserMedia({
            audio: { 
                sampleRate: SAMPLE_RATE,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE
        });

        // Use a smaller buffer size for more frequent processing
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        source = audioContext.createMediaStreamSource(stream);

        processor.onaudioprocess = (event) => {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            
            const inputData = event.inputBuffer.getChannelData(0);
            const int16Data = new Int16Array(inputData.length);
    
            // Convert float32 to int16
            for (let i = 0; i < inputData.length; i++) {
                const sample = Math.max(-1, Math.min(1, inputData[i]));
                int16Data[i] = sample * 0x7FFF;
            }
    
            // Add to buffer
            audioBuffer.push(int16Data);
    
            // Send chunk when we have enough data
            sendAudioChunk();
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        
        isRecording = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        startBtn.textContent = '🎙️ Recording...';
        
        console.log(`Started recording with ${CHUNK_DURATION_MS}ms chunks`);
        
    } catch (error) {
        console.error('Error starting recording:', error);
        alert('Microphone access denied or not available');
        resetUI();
    }
}

function stopRecording() {
    console.log('Stopping recording...');
    
    // Send any remaining audio data
    audioBuffer = [];
    audioChunks = [];
    isPlayingAudio = false;
    isBuffering = false;
    playheadTime = 0;
    
    // Clean up audio context
    if (processor) {
        processor.disconnect();
        processor = null;
    }
    if (source) {
        source.disconnect();
        source = null;
    }
    if (audioContext) {
        audioContext.close().then(() =>{
            audioContext = null;
            console.log('Audio context closed');
        });
        
    }
    
    // Stop media stream
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Close WebSocket
    if (ws) {
        ws.close();
        ws = null;
    }
    
    audioBuffer = [];
    resetUI();
    isPlayingAudio = false;
}

function resetUI() {
    isRecording = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.textContent = 'Start Recording';
    status.textContent = 'Ready';
    status.className = 'status';
}

function handleMessage(data) {
    const timestamp = new Date().toLocaleTimeString();
    
    if (data.type === 'audio_chunk' && data.data) {
        playAudioChunk(data.data);
    } else if (data.type === 'turn_end') {
        addMessage(`👤 You: ${data.text}`, new Date().toLocaleTimeString());
    } else if (data.type === 'llm_response') {
        addMessage(`🤖 AI: ${data.text}`, new Date().toLocaleTimeString(), 'llm-response');
    } else if (data.type === 'stream_end' || data.type === 'audio_end') {
        handleAudioStreamEnd();
    }
}

function addMessage(text, timestamp, className = '') {
    const div = document.createElement('div');
    div.className = `turn ${className}`;
    div.innerHTML = `
        <div class="timestamp">${timestamp}</div>
        <div>${text}</div>
    `;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}
function base64ToPCMFloat32(base64) {
    try {
        // Remove any non-base64 characters
        const cleanBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
        const binary = atob(cleanBase64);
        let offset = 0;
        if (binary.length > 44 && binary.substring(0, 4) === 'RIFF') {
            offset = 44; // Skip WAV header
            console.log('Skipping WAV header (44 bytes)');
        }
        const pcmLength = binary.length - offset;
        const byteArray = new Uint8Array(pcmLength);
        
        for (let i = 0; i < pcmLength; i++) {
            byteArray[i] = binary.charCodeAt(i + offset);
        }
        const view = new DataView(byteArray.buffer);
        const sampleCount = pcmLength / 2;
        const float32Array = new Float32Array(sampleCount);

        for (let i = 0; i < sampleCount; i++) {
            const int16 = view.getInt16(i * 2, true);
            float32Array[i] = int16 / 32768; // Convert to float32 (-1 to 1)
        }
        console.log(`Converted ${pcmLength} bytes to ${sampleCount} samples`);
        return float32Array;
    } catch (error) {
        console.error('Error in base64ToPCMFloat32:', error);
        return null;
    }
}
function playAudioChunk(base64audio) {
    try {
        console.log('Processing audio chunk, length:', base64audio.length);
        
        // Initialize audio context if needed
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100, // Match the server's sample rate
            });
            playheadTime = audioContext.currentTime;
            console.log('Created new audio context with sample rate 44100Hz');
        }
        
        // Convert base64 to PCM float32 array
        const float32Arr = base64ToPCMFloat32(base64audio);
        console.log('Adding audio chunk with', float32Arr.length, 'samples to queue');
        const buffer = audioContext.createBuffer(1,float32Arr.length,44100);
        buffer.copyToChannel(float32Arr,0);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);

        const now = audioContext.currentTime;
        if(playheadTime< now + 0.15){
            playheadTime = now + 0.15;
        }
        source.start(playheadTime);
        playheadTime += buffer.duration;
    } catch(error) {
        console.error("Error in playAudioChunk:", error);
        isPlayingAudio = false;
    }
}

function handleAudioStreamEnd() {
    console.log('Audio stream ended');
    isBuffering = false;
    
    // If we're not currently playing but have chunks, play them
    if (!isPlayingAudio && audioChunks.length > 0) {
        isPlayingAudio = true;
        audioContext.resume().then(() => {
            playNextChunk();
        });
    }
}

window.addEventListener('beforeunload', stopRecording);